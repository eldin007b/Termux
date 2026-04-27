#!/bin/bash

# ==================== GLS SYSTEM RESTORE (STORAGE -> TERMUX) ====================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Putanje
SOURCE_DIR="/storage/emulated/0/Download/Userland/gls-scraper"
DEST_DIR="$HOME/gls-scraper"

clear
echo -e "${BOLD}${RED}╔════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${RED}║   ♻️  GLS SYSTEM RESTORE (UVOZ)       ║${RESET}"
echo -e "${BOLD}${RED}╚════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${RED}${BOLD}UPOZORENJE!${RESET}"
echo -e "Ova radnja će ${BOLD}PREBRISATI${RESET} vašu trenutnu bazu i skripte u Termuxu"
echo -e "podacima koji se nalaze u mapi: ${CYAN}Download/Userland/gls-scraper${RESET}"
echo ""
echo -e "Koristi ovo samo ako si reinstalirao Termux ili želiš vratiti stari bekap."
echo ""

# Provjera postoji li bekap
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}❌ Greška: Mapa s bekapom ne postoji!${RESET}"
    echo -e "Putanja: $SOURCE_DIR"
    echo ""
    echo "Pritisni ENTER za izlaz."
    read
    exit 1
fi

# Potvrda korisnika
echo -e -n "${YELLOW}Jesi li siguran da želiš nastaviti? (y/n): ${RESET}"
read CONFIRM

if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
    echo ""
    echo -e "${CYAN}⏳ Vraćam podatke...${RESET}"
    
    # Koristimo rsync da vratimo sve osim node_modules (njih je bolje instalirati svježe)
    rsync -av --progress "$SOURCE_DIR/" "$DEST_DIR/" \
        --exclude 'node_modules' \
        --exclude '.git'
        
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${BOLD}${GREEN}✅ RESTORE USPJEŠAN!${RESET}"
        echo -e "Podaci su vraćeni."
        
        # Osvježi dozvole za svaki slučaj
        chmod +x *.sh *.js
    else
        echo ""
        echo -e "${BOLD}${RED}❌ GREŠKA PRI VRAĆANJU!${RESET}"
    fi
else
    echo ""
    echo -e "${GREEN}Prekinuto. Ništa nije promijenjeno.${RESET}"
fi

echo ""
echo -e "${CYAN}Pritisni ENTER za povratak u meni...${RESET}"
read
