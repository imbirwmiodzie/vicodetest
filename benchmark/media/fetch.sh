#!/bin/sh
# Downloads the product photos used by the router demo into this folder (needs curl).
# The photos belong to Swisscom (Centro Business guide) and TCL/KOMSA, so they are
# not committed to the repo. Windows: run fetch.cmd instead.
set -e
cd "$(dirname "$0")"
KOMSA="https://www.komsa.pl/Images/Product/Alternative/xlarge/TCL%20LINKKEY%20IK41VE1-2ALCPL2%20Modem%204G%20LTE%20150%20Mbs"

get() {
  if [ -s "$1" ]; then echo "$1: already there"; return; fi
  curl -fsSL --retry 3 -A "Mozilla/5.0" -o "$1.part" "$2" && mv "$1.part" "$1"
  echo "$1: $(wc -c < "$1") bytes"
}

# Centro Business 3.0 back panel, https://cb-guide.swisscom.ch/en/router/router_installation
get cb3-back.png "https://cb-guide.swisscom.ch/en/assets/images/CB3_liegend-208f6c6bf6223955e7861e59178eb1bc.png"
# TCL LinkKey IK41 front (logo, LED) and edge (LTE1/LTE2 antenna sockets), KOMSA product page
get tcl-ik41-front.jpeg "$KOMSA%20(6).jpeg"
get tcl-ik41-edge.jpeg "$KOMSA%20(7).jpeg"
