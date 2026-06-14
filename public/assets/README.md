# Cartella Asset Personalizzati per la tua Convention

In questa cartella puoi inserire tutti i file multimediali (audio, video, immagini, loghi) per personalizzare l'esperienza di gioco.

## File Audio Supportati (Pre-configurati)

Il codice cerca i seguenti file in questa cartella. Se non sono presenti, il gioco continuerà a funzionare normalmente ignorando la riproduzione:

1. **`lobby_music.mp3`**: Musica di sottofondo riprodotta a ciclo continuo (loop) mentre i giocatori si collegano nella stanza d'attesa.
2. **`tick.mp3`**: Suono dei secondi che scorrono (riprodotto negli ultimi 5 secondi di countdown della domanda).
3. **`buzzer.mp3`**: Segnale acustico riprodotto nel momento esatto in cui scade il tempo della domanda.
4. **`reveal.mp3`**: Breve fanfara riprodotta quando viene mostrata la risposta corretta e la distribuzione dei voti.
5. **`victory.mp3`**: Musica trionfale riprodotta nella schermata del podio finale.
6. **`correct.mp3`**: Effetto sonoro riprodotto sullo smartphone del giocatore quando invia una risposta corretta.
7. **`incorrect.mp3`**: Effetto sonoro riprodotto sullo smartphone del giocatore quando invia una risposta errata.

## File Video e Immagini per le Domande

Quando crei o modifichi le domande nel **Creator**, puoi specificare il tipo di media (`immagine` o `video`). 
Puoi inserire percorsi relativi locali riferiti alla cartella `public`.

Ad esempio, se salvi un video in questa cartella con il nome `convention_intro.mp4`, nel Creator dovrai inserire come URL:
`assets/convention_intro.mp4`

In questo modo, quando verrà proiettata quella specifica domanda, il video verrà caricato dal tuo server locale e riprodotto a schermo intero!

## Personalizzazione della Grafica (CSS)

Puoi modificare facilmente i colori del tema (sfondo, pulsanti del controller, scritte) aprendo il file `public/style.css` e cambiando i valori presenti in alto nel blocco `:root`:

```css
:root {
  /* Esempio di modifica colori */
  --bg-gradient: radial-gradient(circle at 50% 50%, #0d1b2a 0%, #1b263b 100%);
  --color-primary: #e0e1dd;
  /* ... */
}
```
