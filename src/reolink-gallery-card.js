import { LitElement, html, css } from 'lit-element';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

const ReolinkGalleryCardVersion = '1.1.0';

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
      selectedEntityFilter: {},
      selectedDateFilter: {},
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
    this.selectedEntityFilter = null;
    this.selectedDateFilter = dayjs().format('YYYY-MM-DD');
    this.entityConfigs = [];
    this._allRawResources = [];
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

  _handleEntityFilterChange(event) {
    event.stopPropagation();
    this.selectedEntityFilter = event.target.value;
    this._updateFilteredResources();
  }

  _handleDateFilterChange(event) {
    event.stopPropagation();
    this.selectedDateFilter = event.target.value;
    this._updateFilteredResources();
  }

  _renderEntityDropdown() {
    if (!this.entityConfigs || this.entityConfigs.length <= 1) return html``;

    return html`
      <select class="entity-dropdown" .value="${this.selectedEntityFilter}" @change="${(e) => this._handleEntityFilterChange(e)}">
        ${this.entityConfigs.map(
          (entity) => html`
            <option value="${entity.path}" ?selected="${this.selectedEntityFilter === entity.path}">
              ${entity.name}
            </option>
          `
        )}
        <option value="all" ?selected="${this.selectedEntityFilter === 'all'}">All</option>
      </select>
    `;
  }

  _renderDateFilter() {
    return html`
      <input
        type="date"
        class="date-picker-input"
        .value="${this.selectedDateFilter || ''}"
        @change="${(e) => this._handleDateFilterChange(e)}"
      />
    `;
  }

  render() {
    const currentRes = this._currentResource();
    const activeSnapshotUrl = this.selectedSnapshotUrl || (currentRes.snapshots && currentRes.snapshots.length > 0 ? currentRes.snapshots[0].url : currentRes.url);
    const activeIsVideoFrame = this._isVideoUrl(activeSnapshotUrl);

    const hasSnapshots = currentRes.snapshots && currentRes.snapshots.length > 0;
    const hasMultipleSnapshots = currentRes.snapshots && currentRes.snapshots.length > 1;
    const hasVideos = currentRes.videos && currentRes.videos.length > 0;
    const hasMultipleVideos = currentRes.videos && currentRes.videos.length > 1;

    return html`
      <ha-card>
        <div class="resource-viewer" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
          <div class="main-dropdown-container">
            ${this._renderEntityDropdown()}
            ${this._renderDateFilter()}
          </div>

          <div class="media-container" @click="${() => this._openModal()}">
            ${activeIsVideoFrame ? html`<video class="thumb-video-frame" preload="metadata" muted playsinline src="${activeSnapshotUrl}#t=0.5"></video>` : html`<img src="${activeSnapshotUrl}" />`}
          </div>

          <figcaption class="caption-bar">
            <span class="caption-text">${currentRes.caption}</span>
          </figcaption>

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

        <div class="card-controls">
          <button class="btn-timelapse ${this.isPlayingTimelapse ? 'active' : ''}" @click="${() => this._toggleTimelapse()}">
            <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
            Timelapse
          </button>
        </div>

        ${this.modalOpen
          ? html`
              <div id="videoModal" class="modal" @click="${() => this._closeModal()}">
                <div class="video-modal-container" @click="${(e) => e.stopPropagation()}">
                  
                  <div class="modal-top-bar">
                    <div class="dropdown-group">
                      ${this._renderEntityDropdown()}
                      ${this._renderDateFilter()}
                    </div>

                    <div class="action-group">
                      <button class="btn-hamburger" @click="${(e) => this._toggleMenu(e)}">
                        <ha-icon icon="mdi:dots-vertical"></ha-icon>
                      </button>

                      ${this.menuOpen
                        ? html`
                            <div class="hamburger-menu" @click="${(e) => e.stopPropagation()}">
                              ${currentRes.snapshots.map(
                                (img, i) => html`
                                  <a class="menu-item" href="${img.url}" download target="_blank">
                                    <ha-icon icon="mdi:file-image-outline"></ha-icon>
                                    <span>Download snapshot ${hasMultipleSnapshots ? i + 1 : ''}</span>
                                  </a>
                                `,
                              )}

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
                  </div>

                  <div class="modal-media-wrapper" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
                    ${this.selectedVideoUrl
                      ? html` <video controls autoplay src="${this.selectedVideoUrl}" @ended="${() => this._handleVideoEnded()}"></video> `
                      : activeIsVideoFrame
                        ? html` <video class="modal-img" preload="metadata" muted playsinline src="${activeSnapshotUrl}#t=0.5"></video> `
                        : html` <img src="${activeSnapshotUrl}" class="modal-img" /> `}

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

                  <div class="modal-header-info">
                    <span class="event-time-title">${currentRes.caption}</span>
                  </div>

                  <div class="video-selector-bar">
                    ${!this.isPlayingTimelapse && hasSnapshots
                      ? currentRes.snapshots.map((img, i) => {
                          const isCurrentSnapshot = !this.selectedVideoUrl && img.url === activeSnapshotUrl;

                          return html`
                            <button
                              class="btn-play-video ${isCurrentSnapshot ? 'active' : ''}"
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

                    ${!this.isPlayingTimelapse && hasVideos
                      ? currentRes.videos.map((vid, i) => {
                          const isCurrentVideo = vid.url === this.selectedVideoUrl;

                          return html`
                            <button
                              class="btn-play-video ${isCurrentVideo ? 'active' : ''}"
                              @click="${() => this._handleVideoClick(vid)}"
                            >
                              <ha-icon icon="mdi:play"></ha-icon>
                              ${hasMultipleVideos ? `Video ${i + 1}` : 'Video'}
                            </button>
                          `;
                        })
                      : html``}

                    <button class="btn-play-video ${this.isPlayingTimelapse ? 'active' : ''}" @click="${() => this._toggleTimelapse()}">
                      <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
                      Timelapse
                    </button>
                  </div>
                </div>
              </div>
            `
          : html``}
      </ha-card>
    `;
  }

  _handleVideoClick(vid) {
    this.selectedVideoUrl = vid.url;
  }

  _handleVideoEnded() {
    if (this.isPlayingTimelapse) {
      this._selectNextTimelapseItem();
    }
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
      this._selectNextTimelapseItem();
    }, duration);
  }

  _selectNextTimelapseItem() {
    if (this.currentResourceIndex >= this.resources.length - 1) {
      this._stopTimelapse();
    } else {
      this._selectResource(this.currentResourceIndex + 1);
    }
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

    this.entityConfigs = config.entities.map((item, index) => {
      if (typeof item === 'string') {
        const fallbackName = decodeURIComponent(item.split('/').filter(Boolean).pop() || `Camera ${index + 1}`);
        return { path: item, name: fallbackName };
      }
      const path = item.path || item.entity || item.media_source || item.source || '';
      const fallbackName = decodeURIComponent(path.split('/').filter(Boolean).pop() || `Camera ${index + 1}`);
      return {
        path: path,
        name: item.name || fallbackName,
      };
    });

    this.config = {
      event_interval: 15,
      video_continuation_interval: 60,
      caption_format: 'DD-MM-YYYY HH:mm:ss',
      ...config,
    };

    if (this.entityConfigs.length > 0) {
      this.selectedEntityFilter = this.entityConfigs[0].path;
    }

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

  _isVideoUrl(url) {
    if (!url) return false;
    const ext = url.split('?')[0].split('#')[0].split('.').pop();
    return !this._isImageExtension(ext);
  }

  _selectResource(index) {
    this.menuOpen = false;

    if (!this.resources || this.resources.length === 0) return;

    let nextResourceIndex = index;
    if (index < 0) nextResourceIndex = this.resources.length - 1;
    else if (index >= this.resources.length) nextResourceIndex = 0;

    this.currentResourceIndex = nextResourceIndex;

    const currentRes = this._currentResource();
    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = currentRes.url;
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

    for (const entity of this.entityConfigs) {
      if (entity.path.substring(0, 15).toLowerCase() === 'media-source://') {
        commands.push(this._loadMediaResource(hass, entity));
      }
    }

    Promise.all(commands).then((resources) => {
      this._allRawResources = resources.filter((result) => !result.error).flat(Number.POSITIVE_INFINITY);
      this._updateFilteredResources();
    });
  }

  _updateFilteredResources() {
    if (!this._allRawResources) return;
    let filtered = this._allRawResources;

    if (this.selectedEntityFilter && this.selectedEntityFilter !== 'all') {
      filtered = filtered.filter((r) => r.entityPath === this.selectedEntityFilter);
    }

    if (this.selectedDateFilter) {
      filtered = filtered.filter((r) => {
        const itemDate = dayjs(r.timestamp).format('YYYY-MM-DD');
        return itemDate === this.selectedDateFilter;
      });
    }

    this.resources = this._groupReolinkMedia(filtered);
    this.currentResourceIndex = 0;

    this.selectedVideoUrl = null;
    this.selectedSnapshotUrl = null;

    this.requestUpdate();
  }

  _parseTimestamp(fileName) {
    if (this.config.file_name_format) {
      const d = dayjs(fileName, this.config.file_name_format);
      if (d.isValid()) return d.valueOf();
    }

    const match = fileName.match(/(\d{4}\d{2}\d{2})_?(\d{2}\d{2}\d{2})/);
    if (match) {
      const d = dayjs(`${match[1]}${match[2]}`, 'YYYYMMDDHHmmss');
      if (d.isValid()) return d.valueOf();
    }

    const d = dayjs(fileName);
    return d.isValid() ? d.valueOf() : 0;
  }

  _groupReolinkMedia(rawResources) {
    const eventIntervalMs = (parseInt(this.config.event_interval, 10) || 15) * 1000;
    const videoContinuationMs = (parseInt(this.config.video_continuation_interval, 10) || 60) * 1000;

    const allItems = rawResources
      .map((item) => ({
        ...item,
        timestamp: this._parseTimestamp(item.name),
      }))
      .filter((item) => item.timestamp > 0);

    allItems.sort((a, b) => a.timestamp - b.timestamp);

    const videoItems = allItems.filter((i) => !this._isImageExtension(i.extension));
    const snapshotItems = allItems.filter((i) => this._isImageExtension(i.extension));

    const events = [];
    videoItems.forEach((vid) => {
      const lastEvent = events[events.length - 1];
      if (lastEvent && vid.timestamp - lastEvent.lastVideoTimestamp <= videoContinuationMs) {
        lastEvent.videos.push(vid);
        lastEvent.lastVideoTimestamp = vid.timestamp;
        lastEvent.end = vid.timestamp;
      } else {
        events.push({
          start: vid.timestamp,
          end: vid.timestamp,
          lastVideoTimestamp: vid.timestamp,
          videos: [vid],
          snapshots: [],
        });
      }
    });

    const unassignedSnapshots = [];

    snapshotItems.forEach((snap) => {
      let matchedEvent = null;

      for (const event of events) {
        const isNearVideo = event.videos.some(
          (vid) => Math.abs(snap.timestamp - vid.timestamp) <= eventIntervalMs
        );

        if (isNearVideo) {
          matchedEvent = event;
          break;
        }
      }

      if (matchedEvent) {
        matchedEvent.snapshots.push(snap);
      } else {
        unassignedSnapshots.push(snap);
      }
    });

    unassignedSnapshots.forEach((snap) => {
      const lastEvent = events[events.length - 1];
      const isSnapshotOnlyEvent = lastEvent && lastEvent.videos.length === 0;

      if (isSnapshotOnlyEvent && snap.timestamp - lastEvent.end <= eventIntervalMs) {
        lastEvent.snapshots.push(snap);
        lastEvent.end = snap.timestamp;
      } else {
        events.push({
          start: snap.timestamp,
          end: snap.timestamp,
          lastVideoTimestamp: 0,
          videos: [],
          snapshots: [snap],
        });
      }
    });

    events.sort((a, b) => b.start - a.start);

    const flatResources = [];
    events.forEach((event) => {
      event.snapshots.sort((a, b) => a.timestamp - b.timestamp);
      event.videos.sort((a, b) => a.timestamp - b.timestamp);

      const sampleItem = event.snapshots[0] || event.videos[0];
      const entityName = sampleItem ? sampleItem.entityName : '';

      const startDate = dayjs(event.start);
      const formattedDate = startDate.format(this.config.caption_format || 'DD-MM-YYYY HH:mm:ss');

      const fullCaption = entityName ? `${entityName} - ${formattedDate}` : formattedDate;

      if (event.snapshots.length > 0) {
        event.snapshots.forEach((snap) => {
          flatResources.push({
            url: snap.url,
            name: snap.name,
            extension: snap.extension,
            caption: fullCaption,
            timestamp: snap.timestamp,
            snapshots: event.snapshots,
            videos: event.videos,
          });
        });
      } else if (event.videos.length > 0) {
        const firstVideo = event.videos[0];
        flatResources.push({
          url: firstVideo.url,
          name: firstVideo.name,
          extension: firstVideo.extension,
          caption: fullCaption,
          timestamp: event.start,
          snapshots: [],
          videos: event.videos,
        });
      }
    });

    return flatResources;
  }

  _loadMediaResource(hass, entity) {
    return new Promise((resolve) => {
      this._loadMedia(hass, entity.path)
        .then((values) => {
          const resources = values
            .map((item) => {
              const res = this._createFileResource(item.authenticated_path);
              if (res) {
                res.entityPath = entity.path;
                res.entityName = entity.name;
              }
              return res;
            })
            .filter(Boolean);
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

    return {
      url: fileRawUrl,
      name: fileName,
      extension,
      caption: fileName,
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
      img,
      .thumb-video-frame {
        width: 100%;
        max-height: 65vh;
        object-fit: contain;
        display: block;
      }

      .caption-bar {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.03);
        text-align: center;
      }
      .caption-text {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.3;
      }

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

      .main-dropdown-container {
        position: relative;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
        background: var(--card-background-color, rgba(0, 0, 0, 0.05));
      }

      .entity-dropdown,
      .date-picker-input {
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 18px;
        padding: 5px 10px;
        font-size: 13px;
        cursor: pointer;
        outline: none;
        backdrop-filter: blur(4px);
        color-scheme: dark;
        font-family: inherit;
      }
      .entity-dropdown option {
        background: #222;
        color: #fff;
      }

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
        padding: 12px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-sizing: border-box;
      }

      /* Bovenbalk in de modal (Entity + Datum + Hamburger + Sluitknop) */
      .modal-top-bar {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
        z-index: 10;
      }
      .dropdown-group,
      .action-group {
        display: flex;
        align-items: center;
        gap: 6px;
        position: relative;
      }

      .btn-hamburger,
      .btn-close-x {
        background: rgba(255, 255, 255, 0.1);
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
        background: rgba(255, 255, 255, 0.25);
      }

      .hamburger-menu {
        position: absolute;
        top: 42px;
        right: 42px;
        background: var(--card-background-color, #222);
        border: 1px solid var(--divider-color, #444);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        min-width: 220px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        z-index: 100;
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

      .modal-header-info {
        width: 100%;
        text-align: center;
        padding: 8px 0 4px 0;
        color: #fff;
      }
      .event-time-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.5px;
        line-height: 1.3;
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
        max-height: 65vh;
        object-fit: contain;
      }
      .video-modal-container video {
        width: 100%;
        max-height: 65vh;
        border-radius: 4px;
      }

      .btn-play-video {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        backdrop-filter: blur(4px);
        transition: all 0.2s ease;
      }
      .btn-play-video:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .btn-play-video.active {
        background: var(--primary-color, #03a9f4) !important;
        border-color: var(--primary-color, #03a9f4) !important;
        font-weight: bold;
        box-shadow: 0 0 8px rgba(3, 169, 244, 0.5);
      }

      .video-selector-bar {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        width: 100%;
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
