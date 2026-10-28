"""Schlanker Client für die REST-API von Capital.com.

Doku: https://open-api.capital.com/
Demo-URL:  https://demo-api-capital.backend-capital.com/api/v1
Live-URL:  https://api-capital.backend-capital.com/api/v1
"""

from __future__ import annotations

import logging
import time
from typing import Any

import requests

log = logging.getLogger(__name__)

BASE_URLS = {
    "demo": "https://demo-api-capital.backend-capital.com/api/v1",
    "live": "https://api-capital.backend-capital.com/api/v1",
}

# Capital.com erlaubt max. 10 Requests/Sekunde -> wir bleiben deutlich darunter.
MIN_SECONDS_BETWEEN_REQUESTS = 0.15


class CapitalAPIError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status
        self.message = message


class CapitalClient:
    def __init__(
        self,
        api_key: str,
        identifier: str,
        password: str,
        environment: str = "demo",
        timeout: float = 15.0,
        session: requests.Session | None = None,
    ):
        if environment not in BASE_URLS:
            raise ValueError(f"environment muss 'demo' oder 'live' sein, nicht {environment!r}")
        self.base_url = BASE_URLS[environment]
        self.environment = environment
        self.api_key = api_key
        self.identifier = identifier
        self.password = password
        self.timeout = timeout
        self.http = session or requests.Session()
        self.cst: str | None = None
        self.security_token: str | None = None
        self.session_info: dict[str, Any] = {}
        self._last_request = 0.0

    # ------------------------------------------------------------------ intern
    def _throttle(self) -> None:
        wait = MIN_SECONDS_BETWEEN_REQUESTS - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        self._last_request = time.monotonic()

    def _headers(self) -> dict[str, str]:
        headers = {"X-CAP-API-KEY": self.api_key, "Content-Type": "application/json"}
        if self.cst and self.security_token:
            headers["CST"] = self.cst
            headers["X-SECURITY-TOKEN"] = self.security_token
        return headers

    def _request(self, method: str, path: str, *, retry_auth: bool = True, **kwargs) -> Any:
        if self.cst is None and path != "/session":
            self.login()
        self._throttle()
        url = f"{self.base_url}{path}"
        resp = self.http.request(method, url, headers=self._headers(), timeout=self.timeout, **kwargs)

        # Sessions laufen nach 10 Minuten Inaktivität ab -> einmal neu einloggen.
        if resp.status_code == 401 and retry_auth and path != "/session":
            log.info("Session abgelaufen, melde mich neu an ...")
            self.login()
            return self._request(method, path, retry_auth=False, **kwargs)

        if resp.status_code >= 400:
            try:
                msg = resp.json().get("errorCode", resp.text)
            except ValueError:
                msg = resp.text
            raise CapitalAPIError(resp.status_code, str(msg))

        if not resp.content:
            return {}
        return resp.json()

    # ----------------------------------------------------------------- Session
    def login(self) -> dict[str, Any]:
        self.cst = self.security_token = None
        self._throttle()
        resp = self.http.post(
            f"{self.base_url}/session",
            json={"identifier": self.identifier, "password": self.password},
            headers=self._headers(),
            timeout=self.timeout,
        )
        if resp.status_code >= 400:
            try:
                msg = resp.json().get("errorCode", resp.text)
            except ValueError:
                msg = resp.text
            raise CapitalAPIError(resp.status_code, f"Login fehlgeschlagen: {msg}")
        self.cst = resp.headers.get("CST")
        self.security_token = resp.headers.get("X-SECURITY-TOKEN")
        if not self.cst or not self.security_token:
            raise CapitalAPIError(resp.status_code, "Login-Antwort enthielt keine Session-Tokens")
        self.session_info = resp.json()
        log.info("Eingeloggt bei Capital.com (%s)", self.environment.upper())
        return self.session_info

    def ping(self) -> None:
        self._request("GET", "/ping")

    # ---------------------------------------------------------------- Konto
    def get_accounts(self) -> list[dict[str, Any]]:
        return self._request("GET", "/accounts").get("accounts", [])

    def get_active_account(self) -> dict[str, Any]:
        accounts = self.get_accounts()
        current = self.session_info.get("currentAccountId")
        for acc in accounts:
            if acc.get("accountId") == current:
                return acc
        for acc in accounts:
            if acc.get("preferred"):
                return acc
        if not accounts:
            raise CapitalAPIError(404, "Kein Handelskonto gefunden")
        return accounts[0]

    # ----------------------------------------------------------------- Märkte
    def get_market(self, epic: str) -> dict[str, Any]:
        return self._request("GET", f"/markets/{epic}")

    def search_markets(self, term: str) -> list[dict[str, Any]]:
        return self._request("GET", "/markets", params={"searchTerm": term}).get("markets", [])

    def get_prices(
        self,
        epic: str,
        resolution: str = "HOUR",
        max_bars: int = 1000,
        start: str | None = None,
        end: str | None = None,
    ) -> list[dict[str, Any]]:
        """Kerzen. Zeitformat: YYYY-MM-DDTHH:MM:SS (UTC). max_bars <= 1000."""
        params: dict[str, Any] = {"resolution": resolution, "max": min(max_bars, 1000)}
        if start:
            params["from"] = start
        if end:
            params["to"] = end
        return self._request("GET", f"/prices/{epic}", params=params).get("prices", [])

    # ----------------------------------------------------------------- Trading
    def get_positions(self) -> list[dict[str, Any]]:
        return self._request("GET", "/positions").get("positions", [])

    def open_position(
        self,
        epic: str,
        direction: str,
        size: float,
        stop_level: float | None = None,
        profit_level: float | None = None,
    ) -> str:
        body: dict[str, Any] = {"epic": epic, "direction": direction, "size": size, "guaranteedStop": False}
        if stop_level is not None:
            body["stopLevel"] = stop_level
        if profit_level is not None:
            body["profitLevel"] = profit_level
        return self._request("POST", "/positions", json=body)["dealReference"]

    def close_position(self, deal_id: str) -> str:
        return self._request("DELETE", f"/positions/{deal_id}").get("dealReference", "")

    def confirm(self, deal_reference: str) -> dict[str, Any]:
        return self._request("GET", f"/confirms/{deal_reference}")
