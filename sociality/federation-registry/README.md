# Federation Registry Data

This directory contains persistent data for the cross-platform federation registry.

## Files

- `data/peers.json` - Registered platform peers (Sociality, Telegram, Discord)
- `data/rooms.json` - Cross-platform room configurations and participants

## Note

The federation registry service is now integrated into the main backend (`npm start`).
This directory only contains the persistent data files that are read/written by the integrated service.

Do not manually edit these files - they are managed automatically by the federation registry service.
