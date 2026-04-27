#!/bin/bash
DIR="$HOME/gls-scraper"
CMD=".next_command"
cd "$DIR" || exit

sync_data() {
    echo "--- Sinkronizacija s GitHubom ---"
    git add .
    if ! git diff-index --quiet HEAD --; then
        git commit -m "Auto-update: $(date +'%Y-%m-%d %H:%M:%S')"
    fi
    git pull origin master --rebase
    git push origin master
    echo "--- Sinkronizacija gotova ---"
}

echo "Provjeravam novosti s GitHuba..."
git pull origin master

while true; do
    node menu.js
    
    if [ -f "$CMD" ]; then
        SCRIPT=$(cat "$CMD")
        rm -f "$CMD"
        
        # 1. OPCIJA: POTPUNO GAŠENJE (EXIT)
        if [ "$SCRIPT" = "EXIT" ]; then
            echo "Gasim i sinkroniziram..."
            sync_data
            exit 0
        fi

        # 2. OPCIJA: POVRATAK U TERMINAL (TERMINAL)
        if [ "$SCRIPT" = "TERMINAL" ]; then
            echo "Vraćam te u Termux..."
            sync_data
            break # Izlazi iz petlje, ostavlja te u folderu
        fi
        
        echo "Pokrećem: $SCRIPT"
        node "$SCRIPT"
        sync_data
        
        echo "Povratak za 3s..."
        sleep 3
    else
        sleep 1
    fi
done
