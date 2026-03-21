# Lokal Testning - Pomodoro

## Starta servrar lokalt

### Sätt upp och starta Backend:

```bash
# Gå till backend-mappen
cd backend

# Starta servern (lyssnar på port 3000)
npm start
```

Du bör se:
```
Servern är igång på http://localhost:3000
```

### Sätt upp och starta Frontend:

I ett **nytt terminalfönster**:

```bash
# Gå till frontend-mappen
cd frontend

# Starta frontend-servern (lyssnar på port 8080)
npm start
```

Du bör se något som:
```
Starting up http-server, serving ./
Hit CTRL-C to stop the server
http://127.0.0.1:8080
```

### Öppna i webbläsare:

Gå till `http://localhost:8080` i din webbläsare.

---

## Växla mellan lokal och produktion

I `frontend/script.js`, ändra denna rad:

```javascript
// För lokal testning:
const SERVER_URL = 'http://localhost:3000';

// För produktion:
const SERVER_URL = 'https://grupp-pomodoro-server.onrender.com';
```

---

## Tips för testning

- Öppna flera webbläsarfönster/tabbar för att testa synkronisering mellan användare
- Använd samma rumnamn i alla fönster för att se timern synka
- Öppna DevTools (F12) för att se eventuella felmeddelanden
