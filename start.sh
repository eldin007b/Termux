#!/bin/bash
DIR="$HOME/gls-scraper"
CMD=".next_command"
cd "$DIR" || exit

# --- FUNKCIJA ZA SYNC ---
sync_data() {
    echo "--- Sinkronizacija s GitHubom ---"
    git add .
    
    # Provjera ima li promjena (zahtijeva bar jedan commit otprije)
    if ! git diff-index --quiet HEAD --; then
        git commit -m "Auto-update: $(date +'%Y-%m-%d %H:%M:%S')"
    fi
    
    # Forsiramo master granu jer vidim iz logova da nju koristiš
    git pull origin master --rebase
    git push origin master
    echo "--- Sinkronizacija gotova ---"
}

# 1. Prvo povuci najnovije stanje
echo "Provjeravam novosti s GitHuba..."
git pull origin master

while true; do
    # 2. Pokreni Meni
    node menu.js
    
    # 3. Provjeri komandu
    if [ -f "$CMD" ]; then
        SCRIPT=$(cat "$CMD")
        rm -f "$CMD"
        
        # POPRAVLJENO: Koristimo jedan [ i = za maksimalnu kompatibilnost
        if [ "$SCRIPT" = "EXIT" ]; then
            echo "Gasim i sinkroniziram..."
            sync_data
            exit 0
        fi
        
        # Pokreni odabranu skriptu
        echo "Pokrećem: $SCRIPT"
        node "$SCRIPT"
        
        # Automatski sync nakon rada
        sync_data
        
        echo "Povratak za 3s..."
        sleep 3
    else
        sleep 1
    fi
done
