"""Risikomanagement: Positionsgröße und Tagesverlust-Bremse."""

from __future__ import annotations

import math
from datetime import date


def position_size(
    equity: float,
    risk_fraction: float,
    stop_distance: float,
    min_size: float,
    size_step: float,
    max_size: float | None = None,
    account_per_quote: float = 1.0,
) -> float:
    """Wie viele Einheiten (bei Gold: Unzen) kaufen, damit ein Stop-Loss genau
    `risk_fraction` des Kontos kostet?

    Beispiel: 10.000 € Konto, 1 % Risiko = 100 €, Stop 20 $ entfernt
    -> 100 / 20 = 5 Unzen (bei Kontowährung USD).

    `account_per_quote` rechnet einen Dollar in Kontowährung um
    (z. B. 0,92 bei einem EUR-Konto, wenn 1 USD = 0,92 EUR).

    Gibt 0 zurück, wenn selbst die Mindestgröße mehr riskieren würde als erlaubt
    -> der Trade wird dann ausgelassen statt das Risiko zu überschreiten.
    """
    if equity <= 0 or stop_distance <= 0 or risk_fraction <= 0:
        return 0.0
    risk_money = equity * risk_fraction
    loss_per_unit = stop_distance * account_per_quote
    raw = risk_money / loss_per_unit
    if max_size is not None:
        raw = min(raw, max_size)
    steps = math.floor(raw / size_step + 1e-9)
    size = round(steps * size_step, 8)
    if size < min_size:
        return 0.0
    return size


class DailyLossGuard:
    """Stoppt neue Trades für den Rest des Tages (UTC), wenn das Konto seit
    Tagesbeginn mehr als `max_daily_loss` (z. B. 0.03 = 3 %) verloren hat."""

    def __init__(self, max_daily_loss: float):
        self.max_daily_loss = max_daily_loss
        self.day: date | None = None
        self.start_equity = 0.0

    def allows_trading(self, equity: float, today: date) -> bool:
        if self.day != today:
            self.day = today
            self.start_equity = equity
        if self.start_equity <= 0:
            return False
        loss = (self.start_equity - equity) / self.start_equity
        return loss < self.max_daily_loss
