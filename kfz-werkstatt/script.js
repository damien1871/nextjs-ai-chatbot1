/* Kfz-Meisterbetrieb Marco Malingriaux – kleine Helfer, kein Framework, kein Tracking. */
(function () {
  "use strict";

  var PHONE_DISPLAY = "0177 8373696";

  /* ---------- Navigation (Handy) ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Header-Linie beim Scrollen ---------- */
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Geöffnet / geschlossen (Zeitzone Berlin, ohne Feiertage) ---------- */
  function berlinNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[map.weekday], minutes: Number(map.hour) * 60 + Number(map.minute) };
    } catch (err) {
      var d = new Date();
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  var now = berlinNow();
  var OPEN = 8 * 60;
  var CLOSE = 17 * 60;
  var isWeekday = now.day >= 1 && now.day <= 5;

  var status = document.getElementById("open-status");
  if (status) {
    var text;
    var open = false;
    if (isWeekday && now.minutes >= OPEN && now.minutes < CLOSE) {
      text = "Jetzt geöffnet, heute bis 17:00 Uhr";
      open = true;
    } else if (isWeekday && now.minutes < OPEN) {
      text = "Heute ab 8:00 Uhr für Sie da";
    } else if (now.day >= 1 && now.day <= 4) {
      text = "Gerade geschlossen. Morgen ab 8:00 Uhr wieder für Sie da";
    } else {
      text = "Gerade geschlossen. Montag ab 8:00 Uhr wieder für Sie da";
    }
    status.textContent = text;
    status.classList.add(open ? "is-open" : "is-closed");
  }

  document.querySelectorAll(".hours tr[data-days]").forEach(function (row) {
    var days = row.getAttribute("data-days").split(",").map(Number);
    if (days.indexOf(now.day) !== -1) row.classList.add("is-today");
  });

  /* ---------- Dezente Scroll-Animation ---------- */
  var reveals = document.querySelectorAll(".reveal");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduceMotion) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Karte erst nach Klick laden (Datenschutz) ---------- */
  var mapBox = document.getElementById("map");
  var mapBtn = document.getElementById("map-load");
  if (mapBox && mapBtn) {
    mapBtn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = mapBox.getAttribute("data-src");
      iframe.title = "Karte: Kfz-Meisterbetrieb Marco Malingriaux, Industriering 2, 64850 Schaafheim";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer";
      mapBox.innerHTML = "";
      mapBox.appendChild(iframe);
      iframe.focus();
    });
  }

  /* ---------- Terminanfrage ---------- */
  var form = document.getElementById("termin-form");
  if (form) {
    var formStatus = document.getElementById("form-status");
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitted = false;

    var rules = [
      { id: "f-name", msg: "Bitte geben Sie Ihren Namen ein." },
      {
        id: "f-phone",
        msg: "Bitte geben Sie eine Telefonnummer ein, unter der wir Sie erreichen.",
        check: function (v) {
          return v.replace(/\D/g, "").length >= 6
            ? ""
            : "Die Telefonnummer scheint unvollständig. Bitte prüfen Sie sie.";
        }
      },
      { id: "f-car", msg: "Bitte nennen Sie kurz Ihr Fahrzeug, zum Beispiel Marke und Modell." },
      { id: "f-msg", msg: "Bitte beschreiben Sie kurz, worum es geht." },
      { id: "f-consent", msg: "Bitte bestätigen Sie die Einwilligung, damit wir Ihre Anfrage bearbeiten dürfen." }
    ];

    var isPlaceholder = function (v) { return !v || /^\[.*\]$/.test(v.trim()); };

    var validateField = function (rule) {
      var field = document.getElementById(rule.id);
      var error = document.getElementById(rule.id + "-error");
      var message = "";
      if (field.type === "checkbox") {
        if (!field.checked) message = rule.msg;
      } else {
        var value = field.value.trim();
        if (!value) message = rule.msg;
        else if (rule.check) message = rule.check(value);
      }
      if (message) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", error.id);
        error.textContent = message;
        error.hidden = false;
      } else {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
        error.textContent = "";
        error.hidden = true;
      }
      return !message;
    };

    rules.forEach(function (rule) {
      var field = document.getElementById(rule.id);
      var evt = field.type === "checkbox" ? "change" : "blur";
      field.addEventListener(evt, function () {
        if (submitted) validateField(rule);
      });
    });

    var setStatus = function (text, type) {
      formStatus.textContent = text;
      formStatus.className = "form-status" + (type ? " is-" + type : "");
    };

    var value = function (id) { return document.getElementById(id).value.trim(); };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitted = true;
      setStatus("");

      var firstInvalid = null;
      rules.forEach(function (rule) {
        if (!validateField(rule) && !firstInvalid) firstInvalid = document.getElementById(rule.id);
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      // Spam-Bots füllen das versteckte Feld aus
      if (value("f-gotcha")) return;

      var endpoint = form.getAttribute("data-formspree");
      var email = form.getAttribute("data-email");

      if (!isPlaceholder(endpoint)) {
        submitBtn.disabled = true;
        setStatus("Anfrage wird gesendet …");
        fetch(endpoint, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            form.reset();
            submitted = false;
            setStatus("Danke! Ihre Anfrage ist angekommen. Wir melden uns telefonisch bei Ihnen.", "success");
          })
          .catch(function () {
            setStatus("Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es noch einmal oder rufen Sie an: " + PHONE_DISPLAY + ".", "error");
          })
          .then(function () { submitBtn.disabled = false; });
        return;
      }

      if (isPlaceholder(email)) {
        setStatus("Das Formular ist noch nicht eingerichtet. Bitte rufen Sie uns an: " + PHONE_DISPLAY + ".", "error");
        return;
      }

      var subject = "Terminanfrage: " + value("f-car");
      var body =
        "Name: " + value("f-name") + "\n" +
        "Telefon: " + value("f-phone") + "\n" +
        "Fahrzeug: " + value("f-car") + "\n\n" +
        "Anliegen:\n" + value("f-msg") + "\n";

      window.location.href =
        "mailto:" + email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      setStatus("Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage. Bitte dort noch auf Senden tippen.", "success");
    });
  }

  /* ---------- Jahr im Footer ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
