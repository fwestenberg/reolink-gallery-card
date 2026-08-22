# Reolink Gallery Card

An advanced Home Assistant Lovelace card for intelligently grouping and viewing Reolink camera footage (snapshots and videos).

> **Credits:** This repository is based on and inspired by the original [gallery-card by lukelalo](https://github.com/lukelalo/gallery-card).

---

## Features

* **Smart Event Grouping:** Automatically merges individual Reolink video files and snapshots into single event cards based on timestamps.
* **In-Card Video & Snapshot Viewer:** View snapshots directly on your dashboard and play corresponding video recordings in an expanded modal.
* **Multi-Video Support:** Switch seamlessly between `Video 1`, `Video 2`, etc. inside the modal view when an event consists of multiple recordings.
* **Timelapse Mode:** Rapidly step through your recorded events with configurable intervals.
* **Direct Downloads:** Easily download snapshots and video files straight from the context menu.

---

## Installation

### Via HACS (Recommended)

Click the button below to open the repository directly inside HACS:

[![Open your Home Assistant instance and show the HACS repository.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=fwestenberg&repository=reolink-gallery-card&category=plugin)

**Manual HACS Installation:**
1. Open **HACS** in Home Assistant.
2. Click on **Frontend**.
3. Click the three dots in the top-right corner and select **Custom repositories**.
4. Enter `https://github.com/fwestenberg/reolink-gallery-card` in the URL field and select **Lovelace Plugin** as the Category.
5. Click **Add** and then **Download**.

---

## Dashboard Configuration

Add the card to your Lovelace dashboard using the code editor:

```yaml
type: custom:reolink-gallery-card
file_name_format: ___________YYYYMMDDHHmmss
caption_format: DD-MM-YYYY - HH:mm
entities:
  - path: media-source://media_source/local/recordings/frontdoor
  - path: media-source://media_source/local/recordings/garden
timelapse_duration: 0.5
