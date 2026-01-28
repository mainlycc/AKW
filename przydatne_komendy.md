## Przydatne komendy

### Cloudflare Tunnel – wystawienie lokalnej aplikacji

```bash
cloudflared tunnel --url http://localhost:3000
```

- **Co robi ta komenda**: Uruchamia tzw. *quick tunnel* w Cloudflare, który tworzy tymczasowy, publiczny adres HTTPS.
- **Jak działa**: Każde żądanie na ten publiczny adres jest tunelowane do Twojej lokalnej aplikacji działającej na `http://localhost:3000` (np. `pnpm dev` z Next.js).
- **Kiedy używać**: Gdy chcesz komuś z zewnątrz udostępnić swoją lokalną aplikację (demo, testy) bez wystawiania portów w routerze/VPN.
- **Wymagania**: Zainstalowany `cloudflared` i wcześniejsze zalogowanie do Cloudflare (`cloudflared login`), żeby tunel mógł się poprawnie połączyć z Twoim kontem.

