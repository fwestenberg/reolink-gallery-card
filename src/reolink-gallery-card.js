import { LitElement, html, css } from 'lit-element';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

const ReolinkGalleryCardVersion = '1.0.2';

console.groupCollapsed(`%cREOLINK-GALLERY-CARD ${ReolinkGalleryCardVersion} IS INSTALLED`, 'color: green; font-weight: bold');
console.log('Readme:', 'https://github.com/fwestenberg/reolink-gallery-card');
console.groupEnd();

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'reolink-gallery-card',
  name: 'Reolink Gallery Card',
  preview: false,
  description: 'The Reolink Gallery Card allows for viewing multiple images/videos.',
});

class GalleryCard extends LitElement {
  static get properties() {
    return {
      _hass: {},
      config: {},
      resources: {},
      currentResourceIndex: {},
      selectedVideoUrl: {},
      selectedSnapshotUrl: {},
      modalOpen: {},
      menuOpen: {},
      isPlayingTimelapse: {},
    };
  }

  constructor() {
    super();
    this.modalOpen = false;
    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = null;
    this.menuOpen = false;
    this.isPlayingTimelapse = false;
    this.timelapseTimer = null;
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._handleKeyDown);
    this._stopTimelapse();
  }

  _handleKeyDown(event) {
    if (!this.modalOpen) return;

    if (event.key === 'ArrowLeft') {
      this._selectResource(this.currentResourceIndex - 1);
    } else if (event.key === 'ArrowRight') {
      this._selectResource(this.currentResourceIndex + 1);
    } else if (event.key === 'Escape') {
      this._closeModal();
    }
  }

  render() {
    const currentRes = this._currentResource();

    const activeSnapshotUrl = this.selectedSnapshotUrl || (currentRes.snapshots.length > 0 ? currentRes.snapshots[0].url : currentRes.url);

    const hasSnapshots = currentRes.snapshots && currentRes.snapshots.length > 0;
    const hasMultipleSnapshots = currentRes.snapshots && currentRes.snapshots.length > 1;
    const hasVideos = currentRes.videos && currentRes.videos.length > 0;
    const hasMultipleVideos = currentRes.videos && currentRes.videos.length > 1;

    return html`
      <ha-card>
        <!-- Hoofdvenster: Dashboard weergave met Swipe functionaliteit -->
        <div class="resource-viewer" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
          <div class="media-container" @click="${() => this._openModal()}">
            <img src="${activeSnapshotUrl}" />
          </div>

          <figcaption class="caption-bar">
            <span class="caption-text">${currentRes.caption}</span>
          </figcaption>

          <!-- Navigatie pijlknopen -->
          <button
            class="btn btn-left"
            @click="${(e) => {
              e.stopPropagation();
              this._selectResource(this.currentResourceIndex - 1);
            }}"
          >
            &lt;
          </button>
          <button
            class="btn btn-right"
            @click="${(e) => {
              e.stopPropagation();
              this._selectResource(this.currentResourceIndex + 1);
            }}"
          >
            &gt;
          </button>
        </div>

        <!-- Timelapse knop onder het dashboard kaartje -->
        <div class="card-controls">
          <button class="btn-timelapse ${this.isPlayingTimelapse ? 'active' : ''}" @click="${() => this._toggleTimelapse()}">
            <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
            Timelapse
          </button>
        </div>

        <!-- Popup Modal voor vergroting snapshot & video afspelen -->
        ${this.modalOpen
          ? html`
              <div id="videoModal" class="modal" @click="${() => this._closeModal()}">
                <div class="video-modal-container" @click="${(e) => e.stopPropagation()}">
                  <!-- Hamburger menu rechtsboven -->
                  <div class="hamburger-container">
                    <button class="btn-hamburger" @click="${(e) => this._toggleMenu(e)}">
                      <ha-icon icon="mdi:dots-vertical"></ha-icon>
                    </button>

                    ${this.menuOpen
                      ? html`
                          <div class="hamburger-menu" @click="${(e) => e.stopPropagation()}">
                            <!-- Download Snapshots -->
                            ${currentRes.snapshots.map(
                              (img, i) => html`
                                <a class="menu-item" href="${img.url}" download target="_blank">
                                  <ha-icon icon="mdi:file-image-outline"></ha-icon>
                                  <span>Download snapshot ${hasMultipleSnapshots ? i + 1 : ''}</span>
                                </a>
                              `,
                            )}

                            <!-- Download Video's -->
                            ${currentRes.videos.map(
                              (vid, i) => html`
                                <a class="menu-item" href="${vid.url}" download target="_blank">
                                  <ha-icon icon="mdi:file-video-outline"></ha-icon>
                                  <span>Download video ${hasMultipleVideos ? i + 1 : ''}</span>
                                </a>
                              `,
                            )}
                          </div>
                        `
                      : html``}

                    <button class="btn-close-x" @click="${() => this._closeModal()}">
                      <ha-icon icon="mdi:close"></ha-icon>
                    </button>
                  </div>

                  <!-- Media Inhoud: Video of Grote Snapshot -->
                  <div class="modal-media-wrapper" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
                    ${this.selectedVideoUrl
                      ? html` <video controls autoplay src="${this.selectedVideoUrl}"></video> `
                      : html` <img src="${activeSnapshotUrl}" class="modal-img" /> `}

                    <!-- Bladerpijlen in modal -->
                    <button
                      class="btn btn-left"
                      @click="${(e) => {
                        e.stopPropagation();
                        this._selectResource(this.currentResourceIndex - 1);
                      }}"
                    >
                      &lt;
                    </button>
                    <button
                      class="btn btn-right"
                      @click="${(e) => {
                        e.stopPropagation();
                        this._selectResource(this.currentResourceIndex + 1);
                      }}"
                    >
                      &gt;
                    </button>
                  </div>

                  <!-- Besturingsbalk ONDER de media -->
                  <div class="video-selector-bar">
                    <!-- Snapshot knop(pen): Verberg actieve snapshot als er geen video gekeken wordt -->
                    ${hasSnapshots
                      ? currentRes.snapshots.map((img, i) => {
                          const isCurrentSnapshot = !this.selectedVideoUrl && img.url === activeSnapshotUrl;
                          if (isCurrentSnapshot) return html``;

                          return html`
                            <button
                              class="btn-play-video"
                              @click="${() => {
                                this.selectedVideoUrl = null;
                                this.selectedSnapshotUrl = img.url;
                              }}"
                            >
                              <ha-icon icon="mdi:image"></ha-icon>
                              ${hasMultipleSnapshots ? `Snapshot ${i + 1}` : 'Snapshot'}
                            </button>
                          `;
                        })
                      : html``}

                    <!-- Video knop(pen): Verberg de momenteel spelende video -->
                    ${hasVideos
                      ? currentRes.videos.map((vid, i) => {
                          const isCurrentVideo = vid.url === this.selectedVideoUrl;
                          if (isCurrentVideo) return html``;

                          return html`
                            <button
                              class="btn-play-video"
                              @click="${() => (this.selectedVideoUrl = vid.url)}"
                            >
                              <ha-icon icon="mdi:play"></ha-icon>
                              ${hasMultipleVideos ? `Video ${i + 1}` : 'Video'}
                            </button>
                          `;
                        })
                      : html``}

                    <!-- Timelapse knop (altijd zichtbaar) -->
                    <button class="btn-play-video ${this.isPlayingTimelapse ? 'active' : ''}" @click="${() => this._toggleTimelapse()}">
                      <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon> Timelapse
                    </button>
                  </div>
                </div>
              </div>
            `
          : html``}
      </ha-card>
    `;
  }

  _toggleTimelapse() {
    if (this.isPlayingTimelapse) {
      this._stopTimelapse();
    } else {
      this._startTimelapse();
    }
  }

  _startTimelapse() {
    this._stopTimelapse();

    if (this.resources && this.currentResourceIndex >= this.resources.length - 1) {
      this._selectResource(0);
    }

    this.isPlayingTimelapse = true;
    const duration = (parseFloat(this.config.timelapse_duration) || 3) * 1000;

    this.timelapseTimer = setInterval(() => {
      if (this.currentResourceIndex >= this.resources.length - 1) {
        this._stopTimelapse();
      } else {
        this._selectResource(this.currentResourceIndex + 1);
      }
    }, duration);
  }

  _stopTimelapse() {
    this.isPlayingTimelapse = false;
    if (this.timelapseTimer) {
      clearInterval(this.timelapseTimer);
      this.timelapseTimer = null;
    }
  }

  _openModal() {
    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = null;
    this.menuOpen = false;
    this.modalOpen = true;
  }

  _closeModal() {
    this.modalOpen = false;
    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = null;
    this.menuOpen = false;
  }

  _toggleMenu(event) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  setConfig(config) {
    dayjs.extend(customParseFormat);
    dayjs.extend(relativeTime);

    if (!config.entities || config.entities.length === 0) {
      throw new Error("Vereiste configuratie 'entities' ontbreekt");
    }

    this.config = config;

    if (this._hass !== undefined) {
      this._loadResources(this._hass);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this.resources === undefined) {
      this._loadResources(this._hass);
    }
  }

  getCardSize() {
    return 3;
  }

  _isImageExtension(extension) {
    return extension.match(/(jpeg|jpg|gif|png|tiff|bmp)$/i);
  }

  _selectResource(index) {
    this.menuOpen = false;
    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = null;

    if (!this.resources || this.resources.length === 0) return;

    let nextResourceIndex = index;
    if (index < 0) nextResourceIndex = this.resources.length - 1;
    else if (index >= this.resources.length) nextResourceIndex = 0;

    this.currentResourceIndex = nextResourceIndex;
  }

  _getResource(index) {
    if (this.resources !== undefined && index !== undefined && this.resources.length > 0) {
      return this.resources[index];
    }
    return {
      url: '',
      name: '',
      extension: 'jpg',
      caption: index === undefined ? 'Laden...' : 'Geen media gevonden',
      index: 0,
      snapshots: [],
      videos: [],
    };
  }

  _currentResource() {
    return this._getResource(this.currentResourceIndex);
  }

  _handleTouchStart(event) {
    this.xDown = event.touches[0].clientX;
    this.yDown = event.touches[0].clientY;
  }

  _handleTouchEnd(event) {
    if (!this.xDown || !this.yDown) return;

    const xUp = event.changedTouches[0].clientX;
    const yUp = event.changedTouches[0].clientY;
    const xDiff = this.xDown - xUp;
    const yDiff = this.yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 40) {
      if (xDiff > 0) {
        this._selectResource(this.currentResourceIndex + 1);
      } else {
        this._selectResource(this.currentResourceIndex - 1);
      }
    }

    this.xDown = null;
    this.yDown = null;
  }

  _loadResources(hass) {
    const commands = [];
    this.currentResourceIndex = undefined;
    this.resources = [];

    for (const entity of this.config.entities) {
      let entityId = typeof entity === 'object' ? entity.path : entity;

      if (entityId.substring(0, 15).toLowerCase() === 'media-source://') {
        commands.push(this._loadMediaResource(hass, entityId));
      }
    }

    Promise.all(commands).then((resources) => {
      let rawResources = resources.filter((result) => !result.error).flat(Number.POSITIVE_INFINITY);
      this.resources = this._groupReolinkMedia(rawResources);
      this.currentResourceIndex = 0;
      this.requestUpdate();
    });
  }

  _groupReolinkMedia(rawResources) {
    const snapshots = [];
    const videos = [];

    for (const item of rawResources) {
      const parsedDate = dayjs(item.name, this.config.file_name_format);
      const timestamp = parsedDate.isValid() ? parsedDate.valueOf() : 0;
      const enriched = { ...item, timestamp };

      if (this._isImageExtension(item.extension)) {
        snapshots.push(enriched);
      } else {
        videos.push(enriched);
      }
    }

    snapshots.sort((a, b) => a.timestamp - b.timestamp);
    videos.sort((a, b) => a.timestamp - b.timestamp);

    const events = [];
    const SNAPSHOT_WINDOW_MS = 25 * 1000;

    for (const video of videos) {
      const matchingSnapshot = snapshots.find(
        (snap) => snap.timestamp >= video.timestamp && snap.timestamp <= video.timestamp + SNAPSHOT_WINDOW_MS
      );

      if (matchingSnapshot) {
        events.push({
          url: matchingSnapshot.url,
          caption: video.caption,
          timestamp: video.timestamp,
          snapshots: [matchingSnapshot],
          videos: [video],
        });
      } else {
        if (events.length > 0) {
          const lastEvent = events[events.length - 1];
          lastEvent.videos.push(video);
        } else {
          events.push({
            url: video.url,
            caption: video.caption,
            timestamp: video.timestamp,
            snapshots: [],
            videos: [video],
          });
        }
      }
    }

    for (const snapshot of snapshots) {
      const alreadyAssigned = events.some((event) =>
        event.snapshots.some((s) => s.url === snapshot.url)
      );

      if (!alreadyAssigned) {
        events.push({
          url: snapshot.url,
          caption: snapshot.caption,
          timestamp: snapshot.timestamp,
          snapshots: [snapshot],
          videos: [],
        });
      }
    }

    events.sort((a, b) => b.timestamp - a.timestamp);
    return events;
  }

  _loadMediaResource(hass, contentId) {
    return new Promise((resolve) => {
      this._loadMedia(hass, contentId)
        .then((values) => {
          const resources = values.map((item) => this._createFileResource(item.authenticated_path)).filter(Boolean);
          resolve(resources);
        })
        .catch(() => resolve([]));
    });
  }

  _loadMedia(hass, contentId) {
    return hass.callWS({ type: 'media_source/browse_media', media_content_id: contentId }).then((result) => {
      let children = result.children || [];
      children = children.filter((item) => item.media_class === 'image' || item.media_class === 'video');

      return Promise.all(children.map((item) => hass.callWS({ type: 'media_source/resolve_media', media_content_id: item.media_content_id, expires: 10800 }).then((auth) => ({ ...item, authenticated_path: auth.url }))));
    });
  }

  _createFileResource(fileRawUrl) {
    const fileUrl = fileRawUrl.split('?')[0];
    const fileName = decodeURIComponent(fileUrl.split('/').at(-1));
    const extension = fileName.split('.').at(-1).toLowerCase();

    let caption = fileName;
    if (this.config.file_name_format && this.config.caption_format) {
      const parsedDate = dayjs(fileName, this.config.file_name_format);
      if (parsedDate.isValid()) {
        caption = parsedDate.format(this.config.caption_format);
      }
    }

    return {
      url: fileRawUrl,
      name: fileName,
      extension,
      caption,
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
      }
      ha-card {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
      }
      .resource-viewer {
        position: relative;
        width: 100%;
        user-select: none;
      }
      .media-container {
        cursor: pointer;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #000;
        width: 100%;
        min-height: 250px;
      }
      img {
        width: 100%;
        max-height: 65vh;
        object-fit: contain;
        display: block;
      }

      /* Caption Bar */
      .caption-bar {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.03);
        text-align: center;
      }
      .caption-text {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Navigatie Knopen */
      .btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        font-size: 18px;
        padding: 14px 10px;
        border: none;
        cursor: pointer;
        border-radius: 4px;
        z-index: 2;
      }
      .btn-left {
        left: 10px;
      }
      .btn-right {
        right: 10px;
      }

      /* Dashboard controls (onder de foto) */
      .card-controls {
        display: flex;
        justify-content: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.02);
      }
      .btn-timelapse {
        background: var(--primary-color, #03a9f4);
        color: #fff;
        border: none;
        padding: 6px 14px;
        border-radius: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        transition: background 0.2s ease;
      }
      .btn-timelapse.active {
        background: #e53935;
      }

      /* Video / Snapshot Modal Overlay */
      .modal {
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        z-index: 9999;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.92);
      }
      .video-modal-container {
        position: relative;
        width: 90%;
        max-width: 950px;
        background: #000;
        padding: 10px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .modal-media-wrapper {
        position: relative;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .modal-img {
        width: 100%;
        max-height: 75vh;
        object-fit: contain;
      }
      .video-modal-container video {
        width: 100%;
        max-height: 75vh;
        border-radius: 4px;
      }

      .btn-play-video {
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.4);
        padding: 8px 18px;
        border-radius: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        backdrop-filter: blur(4px);
        transition: background 0.2s ease;
      }
      .btn-play-video:hover {
        background: var(--primary-color, #03a9f4);
        border-color: var(--primary-color, #03a9f4);
      }
      .btn-play-video.active {
        background: var(--primary-color, #03a9f4);
        border-color: var(--primary-color, #03a9f4);
      }

      /* Control bar ONDER de media in de modal */
      .video-selector-bar {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        width: 100%;
      }

      /* Hamburger menu rechtsbovenin de modal */
      .hamburger-container {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 10000;
        display: flex;
        gap: 8px;
      }
      .btn-hamburger,
      .btn-close-x {
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .btn-hamburger:hover,
      .btn-close-x:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .hamburger-menu {
        position: absolute;
        top: 45px;
        right: 0;
        background: var(--card-background-color, #222);
        border: 1px solid var(--divider-color, #444);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        min-width: 200px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        color: var(--primary-text-color, #fff);
        text-decoration: none;
        font-size: 13px;
        cursor: pointer;
      }
      .menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .menu-item ha-icon {
        --mdc-icon-size: 20px;
        color: var(--primary-text-color, #fff);
      }
    `;
  }
}
customElements.define('reolink-gallery-card', GalleryCard);

console.groupCollapsed(`%cREOLINK-GALLERY-CARD ${ReolinkGalleryCardVersion} IS INSTALLED`, 'color: green; font-weight: bold');
console.log('Readme:', 'https://github.com/fwestenberg/reolink-gallery-card');
console.groupEnd();

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'reolink-gallery-card',
  name: 'Reolink Gallery Card',
  preview: false,
  description: 'The Reolink Gallery Card allows for viewing multiple images/videos.',
});
