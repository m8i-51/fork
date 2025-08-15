SHELL := /bin/bash

.PHONY: livekit-up livekit-down web-dev

livekit-up:
	cd livekit && docker compose up -d

livekit-down:
	cd livekit && docker compose down

web-dev:
	cd web && npm install && npm run dev
