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

        # 1. OPCIJA: POTPUNO GAŠENJE CIJELOG TERMUXA (EXIT)
        if [ "$SCRIPT" = "EXIT" ]; then
            echo "Gasim sve i sinkroniziram..."
            sync_data
            echo "Doviđenja!"
            # Ova naredba gasi cijeli Termux proces
            pkill -9 com.termux
            exit 0
        fi

        # 2. OPCIJA: POVRATAK U KONZOLU (TERMINAL)
        if [ "$SCRIPT" = "TERMINAL" ]; then
            echo "Vraćam te u Termux terminal..."
            sync_data
            break # Izlazi iz petlje, ostavlja te u folderu spreman za rad
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
