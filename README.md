# Gesichtsübungen – Video-PWA

Kleine Progressive Web App, die genau ein YouTube-Video stumm und im
Vollbild abspielt — ohne Play-Buttons, YouTube-Oberfläche oder
Hintergrundmusik. Da das Video stummgeschaltet ist, kann parallel z. B.
ein Podcast in einer anderen App weiterlaufen.

## Installation auf dem iPhone

1. Diese Dateien auf irgendeinem HTTPS-Host bereitstellen (z. B. GitHub
   Pages, Netlify, Vercel — ein simples statisches Hosting reicht).
   iOS verlangt HTTPS für Service Worker/„Zum Home-Bildschirm".
2. Die URL in Safari auf dem iPhone öffnen.
3. Teilen-Icon → **Zum Home-Bildschirm**.
4. App vom Home-Bildschirm starten (läuft dann ohne Safari-Oberfläche,
   randlos).

## Erste Benutzung

Beim allerersten Start erscheint ein Eingabefeld für den YouTube-Link
(z. B. `https://youtu.be/…`, `https://www.youtube.com/watch?v=…` oder
auch nur die Video-ID). Der Link wird nur lokal auf dem Gerät
gespeichert (`localStorage`) — es gibt keinen Server, keine Datenbank.

Zum Ändern des Videos später: oben rechts kurz auf den Bildschirm
tippen — dort blendet sich für ein paar Sekunden ein kleines
Zahnrad-Icon ein, darüber lässt sich der Link erneut setzen.

Ein Tipp irgendwo auf den Bildschirm pausiert/startet das Video.

## Wie es funktioniert

- Das Video wird über die YouTube-IFrame-API eingebettet mit
  `controls:0`, `disablekb:1`, `modestbranding:1`, `rel:0`,
  `iv_load_policy:3` — dadurch verschwinden Standard-Bedienelemente,
  Vorschläge und die meisten Overlays.
- Eine transparente Ebene über dem Video fängt alle Taps ab, damit man
  nie versehentlich auf einen YouTube-Link oder das Branding tippt.
- Das Video ist dauerhaft stummgeschaltet (`mute:1`) und läuft in
  Endlosschleife (`loop:1`). Weil kein eigener Ton läuft, unterbricht
  es keine Audiowiedergabe aus einer anderen App (z. B. Podcasts).
- Die Größe wird per JS wie ein `object-fit: cover` berechnet, damit
  das 16:9-Video den ganzen Bildschirm füllt (mit Beschnitt oben/unten
  oder links/rechts, je nach Seitenverhältnis des iPhones).
- Ein Service Worker cached die App-Hülle (HTML/CSS/JS/Icons), sodass
  die App auch bei wackligem Netz sofort startet. Nur das eigentliche
  Video braucht weiterhin eine Internetverbindung, da es live von
  YouTube gestreamt wird.
- Per Wake-Lock-API (falls vom iOS-Safari unterstützt) versucht die
  App, den Bildschirm während der Übung nicht einschlafen zu lassen.

## Grenzen

- YouTube kann in Einzelfällen trotz `controls:0` kurz eigene
  Overlays einblenden (z. B. beim allerersten Tap) — die transparente
  Tap-Ebene verhindert aber, dass man versehentlich etwas davon
  antippt.
- Ob eine parallele App-Audiowiedergabe (Podcast) wirklich
  unterbrechungsfrei bleibt, hängt letztlich von iOS' Audiosession-
  Verhalten ab; da das YouTube-Video aber nie Ton abspielt, sollte es
  in der Praxis nicht dazwischenfunken.
- Nur für den persönlichen Gebrauch gedacht (eigenes Übungsvideo).
