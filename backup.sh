#!/bin/bash

# ==================== GLS SYSTEM SYNC (TERMUX -> STORAGE) ====================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

clear
echo -e "${BOLD}${CYAN}╔════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   🔄 GLS SCRAPER SYNC (EXPORT)        ║${RESET}"
echo -e "${BOLD}${CYAN}╚════════════════════════════════════════╝${RESET}"
echo ""

# 1. Definiranje putanja
SOURCE_DIR="$HOME/gls-scraper"
# Ovdje upisujemo putanju do tvoje STARE mape gdje želiš prebaciti nove fajlove
DEST_DIR="/storage/emulated/0/Download/Userland/gls-scraper"

echo -e "${CYAN}ℹ${RESET} Izvor (Termux): ${BOLD}$SOURCE_DIR${RESET}"
echo -e "${CYAN}ℹ${RESET} Cilj (Memorija): ${BOLD}$DEST_DIR${RESET}"
echo ""

# 2. Provjera i kreiranje mape ako fali
if [ ! -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}📂 Ciljna mapa ne postoji. Kreiram...${RESET}"
    mkdir -p "$DEST_DIR"
fi

# 3. Kopiranje
echo -e "${YELLOW}⏳ Kopiram nove fajlove i mijenjam stare...${RESET}"

# Kopiramo sve bitno, ali preskačemo teške stvari poput node_modules da bude brže
# Ako želiš i module, makni --exclude 'node_modules'
rsync -av --progress "$SOURCE_DIR/" "$DEST_DIR/" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'gls-backup-*.tar.gz' \
    --exclude 'nps-log-*.jsonl'

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${BOLD}${GREEN}╔════════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}${GREEN}║   ✅ SINKRONIZACIJA USPJEŠNA!         ║${RESET}"
    echo -e "${BOLD}${GREEN}╚════════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "Nove skripte su sada u mapi: ${BOLD}Download/Userland/gls-scraper${RESET}"
else
    echo ""
    echo -e "${BOLD}${RED}❌ GREŠKA KOD KOPIRANJA!${RESET}"
    echo "Provjeri ima li Termux dozvolu za pohranu (upiši: termux-setup-storage)"
fi

