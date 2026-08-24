import { LitElement, html, css } from 'lit-element';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

const ReolinkGalleryCardVersion = '1.3.2';

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
      selectedStartDateTime: {},
      selectedEndDateTime: {},
      showDatePickerModal: {},
      selectedPreset: {},
      _loading: {},
    };
  }

  constructor() {
    super();
    this.modalOpen = false;
    this.selectedVideoUrl = null;
    this.selectedVideoMediaContentId = null;
    this.selectedSnapshotUrl = null;
    this.menuOpen = false;
    this.isPlayingTimelapse = false;
    this.timelapseTimer = null;
    this.selectedEntityFilter = null;
    this.showDatePickerModal = false;
    this.selectedPreset = 'today';
    this._loading = false;

    this.selectedStartDateTime = dayjs().startOf('day').format('YYYY-MM-DDTHH:mm');
    this.selectedEndDateTime = dayjs().endOf('day').format('YYYY-MM-DDTHH:mm');

    this.entityConfigs = [];
    this._allRawResources = [];

    this._urlCache = new Map();
    this._pendingResolves = new Map();
    this._imageCache = new Map();
    this._mediaBrowseCache = new Map();

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

  _t(key) {
    const lang = this._hass && this._hass.language ? this._hass.language.substring(0, 2) : 'en';
    const dict = {
      nl: {
        today: 'Vandaag',
        yesterday: 'Gisteren',
        dayBeforeYesterday: 'Eergisteren',
        last24h: 'Afgelopen 24 uur',
        last7days: 'Afgelopen 7 dagen',
        lastMonth: 'Afgelopen maand',
        select_date: 'Selecteer datum',
        from: 'Van',
        to: 'Tot',
        close: 'Sluiten',
        loading: 'Laden...',
        no_media: 'Geen media gevonden',
        snapshot: 'Snapshot',
        video: 'Video',
        timelapse: 'Timelapse',
        download_snapshot: 'Download snapshot',
        download_video: 'Download video',
        all: 'Alles',
      },
      en: {
        today: 'Today',
        yesterday: 'Yesterday',
        dayBeforeYesterday: 'Day before yesterday',
        last24h: 'Last 24 hours',
        last7days: 'Last 7 days',
        lastMonth: 'Last month',
        select_date: 'Select date',
        from: 'From',
        to: 'To',
        close: 'Close',
        loading: 'Loading...',
        no_media: 'No media found',
        snapshot: 'Snapshot',
        video: 'Video',
        timelapse: 'Timelapse',
        download_snapshot: 'Download snapshot',
        download_video: 'Download video',
        all: 'All',
      },
      de: {
        today: 'Heute',
        yesterday: 'Gestern',
        dayBeforeYesterday: 'Vorgestern',
        last24h: 'Letzte 24 Stunden',
        last7days: 'Letzte 7 Tage',
        lastMonth: 'Letzter Monat',
        select_date: 'Datum auswählen',
        from: 'Von',
        to: 'Bis',
        close: 'Schließen',
        loading: 'Laden...',
        no_media: 'Keine Medien gefunden',
        snapshot: 'Snapshot',
        video: 'Video',
        timelapse: 'Zeitraffer',
        download_snapshot: 'Snapshot herunterladen',
        download_video: 'Video herunterladen',
        all: 'Alle',
      },
      fr: {
        today: "Aujourd'hui",
        yesterday: 'Hier',
        dayBeforeYesterday: 'Avant-hier',
        last24h: 'Dernières 24 heures',
        last7days: '7 derniers jours',
        lastMonth: 'Dernier mois',
        select_date: 'Sélectionner une date',
        from: 'De',
        to: 'À',
        close: 'Fermer',
        loading: 'Chargement...',
        no_media: 'Aucun média trouvé',
        snapshot: 'Snapshot',
        video: 'Vidéo',
        timelapse: 'Timelapse',
        download_snapshot: 'Télécharger snapshot',
        download_video: 'Télécharger vidéo',
        all: 'Tous',
      },
    };
    const translations = dict[lang] || dict['en'];
    return translations[key] || dict['en'][key] || key;
  }

  _isDarkMode() {
    return !!(this._hass && this._hass.themes && this._hass.themes.darkMode);
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

  _setPresetRange(type) {
    this.selectedPreset = type;
    const now = dayjs();
    if (type === 'today') {
      this.selectedStartDateTime = now.startOf('day').format('YYYY-MM-DDTHH:mm');
      this.selectedEndDateTime = now.endOf('day').format('YYYY-MM-DDTHH:mm');
    } else if (type === 'yesterday') {
      const y = now.subtract(1, 'day');
      this.selectedStartDateTime = y.startOf('day').format('YYYY-MM-DDTHH:mm');
      this.selectedEndDateTime = y.endOf('day').format('YYYY-MM-DDTHH:mm');
    } else if (type === 'last7days') {
      this.selectedStartDateTime = now.subtract(7, 'day').startOf('day').format('YYYY-MM-DDTHH:mm');
      this.selectedEndDateTime = now.endOf('day').format('YYYY-MM-DDTHH:mm');
    } else if (type === 'lastMonth') {
      this.selectedStartDateTime = now.subtract(1, 'month').startOf('day').format('YYYY-MM-DDTHH:mm');
      this.selectedEndDateTime = now.endOf('day').format('YYYY-MM-DDTHH:mm');
    }
    if (this._hass) {
      this._loadResources(this._hass);
    }
  }

  _shiftDay(direction) {
    this.selectedPreset = null;
    const nowEnd = dayjs().endOf('day');
    const start = dayjs(this.selectedStartDateTime).add(direction, 'day');
    const end = dayjs(this.selectedEndDateTime).add(direction, 'day');

    if (direction > 0 && start.isAfter(nowEnd)) {
      return;
    }

    const clampedEnd = end.isAfter(nowEnd) ? nowEnd : end;

    this.selectedStartDateTime = start.format('YYYY-MM-DDTHH:mm');
    this.selectedEndDateTime = clampedEnd.format('YYYY-MM-DDTHH:mm');
    if (this._hass) {
      this._loadResources(this._hass);
    }
  }

  _formatLabelDate() {
    const s = dayjs(this.selectedStartDateTime);
    const e = dayjs(this.selectedEndDateTime);
    if (!s.isValid() || !e.isValid()) return this._t('select_date');

    const now = dayjs();
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    const yesterdayStart = now.subtract(1, 'day').startOf('day');
    const yesterdayEnd = now.subtract(1, 'day').endOf('day');
    const eergisterenStart = now.subtract(2, 'day').startOf('day');
    const eergisterenEnd = now.subtract(2, 'day').endOf('day');
    const last7daysStart = now.subtract(7, 'day').startOf('day');
    const lastMonthStart = now.subtract(1, 'month').startOf('day');

    const isSameRange = (startRef, endRef) =>
      Math.abs(s.diff(startRef, 'minute')) <= 1 && Math.abs(e.diff(endRef, 'minute')) <= 1;

    if (isSameRange(todayStart, todayEnd)) return this._t('today');
    if (isSameRange(yesterdayStart, yesterdayEnd)) return this._t('yesterday');
    if (isSameRange(eergisterenStart, eergisterenEnd)) return this._t('dayBeforeYesterday');
    if (isSameRange(last7daysStart, todayEnd)) return this._t('last7days');
    if (isSameRange(lastMonthStart, todayEnd)) return this._t('lastMonth');

    const isFullDayRange = s.format('HH:mm') === '00:00' && e.format('HH:mm') === '23:59';

    if (s.isSame(e, 'day')) {
      let dayPrefix = '';
      if (s.isSame(todayStart, 'day')) dayPrefix = this._t('today');
      else if (s.isSame(yesterdayStart, 'day')) dayPrefix = this._t('yesterday');
      else if (s.isSame(eergisterenStart, 'day')) dayPrefix = this._t('dayBeforeYesterday');

      if (isFullDayRange) {
        return dayPrefix || s.format('D MMM');
      }

      if (dayPrefix) {
        return `${dayPrefix} ${s.format('HH:mm')} - ${e.format('HH:mm')}`;
      }
      return `${s.format('D MMM HH:mm')} - ${e.format('HH:mm')}`;
    }

    if (isFullDayRange) {
      return `${s.format('D MMM')} - ${e.format('D MMM')}`;
    }

    return `${s.format('D MMM HH:mm')} - ${e.format('D MMM HH:mm')}`;
  }

  _renderEntityDropdown() {
    if (!this.entityConfigs || this.entityConfigs.length <= 1) return html``;

    return html`
      <select class="entity-dropdown" .value="${this.selectedEntityFilter}" @change="${(e) => this._handleEntityFilterChange(e)}">
        ${this.entityConfigs.map((entity) => html` <option value="${entity.path}" ?selected="${this.selectedEntityFilter === entity.path}">${entity.name}</option> `)}
        <option value="all" ?selected="${this.selectedEntityFilter === 'all'}">${this._t('all')}</option>
      </select>
    `;
  }

  _renderDateFilterBar() {
    const maxDateTime = dayjs().endOf('day').format('YYYY-MM-DDTHH:mm');

    return html`
      <div class="ha-energy-date-bar">
        <button
          class="date-display-btn"
          @click="${(e) => {
            e.stopPropagation();
            this.showDatePickerModal = !this.showDatePickerModal;
          }}"
        >
          <ha-icon icon="mdi:calendar-month"></ha-icon>
          <span>${this._formatLabelDate()}</span>
        </button>

        <button
          class="icon-nav-btn"
          @click="${(e) => {
            e.stopPropagation();
            this._shiftDay(-1);
          }}"
        >
          &lt;
        </button>
        <button
          class="icon-nav-btn"
          @click="${(e) => {
            e.stopPropagation();
            this._shiftDay(1);
          }}"
        >
          &gt;
        </button>

        ${this.showDatePickerModal
          ? html`
              <div class="date-picker-popover" @click="${(e) => e.stopPropagation()}">
                <div class="popover-presets">
                  <button
                    @click="${() => {
                      this._setPresetRange('today');
                      this.showDatePickerModal = false;
                    }}"
                  >
                    ${this._t('today')}
                  </button>
                  <button
                    @click="${() => {
                      this._setPresetRange('yesterday');
                      this.showDatePickerModal = false;
                    }}"
                  >
                    ${this._t('yesterday')}
                  </button>
                  <button
                    @click="${() => {
                      this._setPresetRange('last7days');
                      this.showDatePickerModal = false;
                    }}"
                  >
                    ${this._t('last7days')}
                  </button>
                  <button
                    @click="${() => {
                      this._setPresetRange('lastMonth');
                      this.showDatePickerModal = false;
                    }}"
                  >
                    ${this._t('lastMonth')}
                  </button>
                </div>
                <div class="popover-custom-range">
                  <div class="field-group">
                    <label>${this._t('from')}</label>
                    <input
                      type="datetime-local"
                      max="${maxDateTime}"
                      .value="${this.selectedStartDateTime || ''}"
                      @change="${(e) => {
                        this.selectedPreset = null;
                        let val = e.target.value;
                        if (dayjs(val).isAfter(dayjs().endOf('day'))) {
                          val = maxDateTime;
                          e.target.value = val;
                        }
                        this.selectedStartDateTime = val;
                        if (this._hass) this._loadResources(this._hass);
                      }}"
                    />
                  </div>
                  <div class="field-group">
                    <label>${this._t('to')}</label>
                    <input
                      type="datetime-local"
                      max="${maxDateTime}"
                      .value="${this.selectedEndDateTime || ''}"
                      @change="${(e) => {
                        this.selectedPreset = null;
                        let val = e.target.value;
                        if (dayjs(val).isAfter(dayjs().endOf('day'))) {
                          val = maxDateTime;
                          e.target.value = val;
                        }
                        this.selectedEndDateTime = val;
                        if (this._hass) this._loadResources(this._hass);
                      }}"
                    />
                  </div>
                </div>
                <div class="popover-actions">
                  <button class="btn-apply" @click="${() => (this.showDatePickerModal = false)}">${this._t('close')}</button>
                </div>
              </div>
            `
          : html``}
      </div>
    `;
  }

  render() {
    const hasResources = this.resources && this.resources.length > 0;
    const isLoading = this._loading || this.resources === undefined;
    const currentRes = this._currentResource();

    const activeSnapshot = currentRes.snapshots && currentRes.snapshots.length > 0 ? currentRes.snapshots.find((s) => s.url && s.url === this.selectedSnapshotUrl) || currentRes.snapshots[0] : null;

    const activeSnapshotUrl = this.selectedSnapshotUrl || (activeSnapshot ? activeSnapshot.url : currentRes.url);
    const activeIsVideoFrame = this._isVideoUrl(activeSnapshotUrl || currentRes.name);

    const hasSnapshots = currentRes.snapshots && currentRes.snapshots.length > 0;
    const hasMultipleSnapshots = currentRes.snapshots && currentRes.snapshots.length > 1;
    const hasVideos = currentRes.videos && currentRes.videos.length > 0;
    const hasMultipleVideos = currentRes.videos && currentRes.videos.length > 1;
    const colorScheme = this._isDarkMode() ? 'dark' : 'light';

    const isAtStart = this.currentResourceIndex <= 0;
    const isAtEnd = !this.resources || this.currentResourceIndex >= this.resources.length - 1;

    return html`
      <ha-card style="color-scheme: ${colorScheme};" @click="${() => (this.showDatePickerModal = false)}">
        <div class="resource-viewer" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
          <div class="main-dropdown-container">${this._renderEntityDropdown()} ${this._renderDateFilterBar()}</div>

          <div class="media-container" @click="${() => this._openModal()}">
            ${isLoading
              ? html`<div class="placeholder-text">${this._t('loading')}</div>`
              : !hasResources
                ? html`<div class="no-media-box"><span class="placeholder-text">${this._t('no_media')}</span></div>`
                : activeSnapshotUrl
                  ? activeIsVideoFrame
                    ? html`<video class="thumb-video-frame" preload="metadata" muted playsinline src="${activeSnapshotUrl}#t=0.5"></video>`
                    : html`<img src="${activeSnapshotUrl}" />`
                  : html`<div class="placeholder-text">${this._t('loading')}</div>`}
          </div>

          <figcaption class="caption-bar">
            <span class="caption-text">${currentRes.caption}</span>
          </figcaption>

          ${hasResources
            ? html`
                <button
                  class="btn btn-left"
                  ?disabled="${isAtStart}"
                  @click="${(e) => {
                    e.stopPropagation();
                    this._selectResource(this.currentResourceIndex - 1);
                  }}"
                >
                  &lt;
                </button>
                <button
                  class="btn btn-right"
                  ?disabled="${isAtEnd}"
                  @click="${(e) => {
                    e.stopPropagation();
                    this._selectResource(this.currentResourceIndex + 1);
                  }}"
                >
                  &gt;
                </button>
              `
            : html``}
        </div>

        <div class="card-controls">
          <button class="btn-timelapse ${this.isPlayingTimelapse ? 'active' : ''}" ?disabled="${!hasResources}" @click="${() => this._toggleTimelapse()}">
            <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
            ${this._t('timelapse')}
          </button>
        </div>

        ${this.modalOpen
          ? html`
              <div id="videoModal" class="modal" @click="${() => this._closeModal()}">
                <div class="video-modal-container" @click="${(e) => e.stopPropagation()}">
                  <div class="modal-top-bar">
                    <div class="dropdown-group">${this._renderEntityDropdown()} ${this._renderDateFilterBar()}</div>

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
                                    <span>${this._t('download_snapshot')} ${hasMultipleSnapshots ? i + 1 : ''}</span>
                                  </a>
                                `,
                              )}
                              ${currentRes.videos.map(
                                (vid, i) => html`
                                  <a class="menu-item" href="${vid.url}" download target="_blank">
                                    <ha-icon icon="mdi:file-video-outline"></ha-icon>
                                    <span>${this._t('download_video')} ${hasMultipleVideos ? i + 1 : ''}</span>
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
                    ${isLoading
                      ? html`<div class="no-media-box"><span class="placeholder-text">${this._t('loading')}</span></div>`
                      : !hasResources
                        ? html`<div class="no-media-box"><span class="placeholder-text">${this._t('no_media')}</span></div>`
                        : this.selectedVideoUrl
                          ? html` <video controls autoplay src="${this.selectedVideoUrl}" @ended="${() => this._handleVideoEnded()}"></video> `
                          : activeIsVideoFrame
                            ? html` <video class="modal-img" preload="metadata" muted playsinline src="${activeSnapshotUrl}#t=0.5"></video> `
                            : html` <img src="${activeSnapshotUrl}" class="modal-img" /> `}
                    ${hasResources
                      ? html`
                          <button
                            class="btn btn-left"
                            ?disabled="${isAtStart}"
                            @click="${(e) => {
                              e.stopPropagation();
                              this._selectResource(this.currentResourceIndex - 1);
                            }}"
                          >
                            &lt;
                          </button>
                          <button
                            class="btn btn-right"
                            ?disabled="${isAtEnd}"
                            @click="${(e) => {
                              e.stopPropagation();
                              this._selectResource(this.currentResourceIndex + 1);
                            }}"
                          >
                            &gt;
                          </button>
                        `
                      : html``}
                  </div>

                  <div class="modal-header-info">
                    <span class="event-time-title">${currentRes.caption}</span>
                  </div>

                  ${hasResources
                    ? html`
                        <div class="video-selector-bar">
                          ${!this.isPlayingTimelapse && hasSnapshots
                            ? currentRes.snapshots.map((img, i) => {
                                const isCurrentSnapshot = !this.selectedVideoUrl && activeSnapshot && (img === activeSnapshot || (img.media_content_id && activeSnapshot.media_content_id && img.media_content_id === activeSnapshot.media_content_id));

                                return html`
                                  <button
                                    class="btn-play-video ${isCurrentSnapshot ? 'active' : ''}"
                                    @click="${async () => {
                                      if (!img.url) await this._resolveResourceUrl(img);
                                      this.selectedVideoUrl = null;
                                      this.selectedVideoMediaContentId = null;
                                      this.selectedSnapshotUrl = img.url;
                                      this.requestUpdate();
                                    }}"
                                  >
                                    <ha-icon icon="mdi:image"></ha-icon>
                                    ${hasMultipleSnapshots ? `${this._t('snapshot')} ${i + 1}` : this._t('snapshot')}
                                  </button>
                                `;
                              })
                            : html``}
                          ${!this.isPlayingTimelapse && hasVideos
                            ? currentRes.videos.map((vid, i) => {
                                const isCurrentVideo = !!this.selectedVideoUrl && ((vid.url && vid.url === this.selectedVideoUrl) || (this.selectedVideoMediaContentId && vid.media_content_id === this.selectedVideoMediaContentId));

                                return html`
                                  <button
                                    class="btn-play-video ${isCurrentVideo ? 'active' : ''}"
                                    @click="${async () => {
                                      if (!vid.url) await this._resolveResourceUrl(vid);
                                      this.selectedVideoMediaContentId = vid.media_content_id;
                                      this._handleVideoClick(vid);
                                    }}"
                                  >
                                    <ha-icon icon="mdi:play"></ha-icon>
                                    ${hasMultipleVideos ? `${this._t('video')} ${i + 1}` : this._t('video')}
                                  </button>
                                `;
                              })
                            : html``}

                          <button class="btn-play-video ${this.isPlayingTimelapse ? 'active' : ''}" @click="${() => this._toggleTimelapse()}">
                            <ha-icon icon="${this.isPlayingTimelapse ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
                            ${this._t('timelapse')}
                          </button>
                        </div>
                      `
                    : html``}
                </div>
              </div>
            `
          : html``}
      </ha-card>
    `;
  }

  _handleVideoClick(vid) {
    this.selectedVideoUrl = vid.url;
    this.requestUpdate();
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
    const duration = (parseFloat(this.config.timelapse_duration) || 0.5) * 1000;

    this._preloadAhead(this.currentResourceIndex, 25);

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
    this.requestUpdate();
  }

  _openModal() {
    this.selectedVideoUrl = null;
    this.selectedVideoMediaContentId = null;
    this.selectedSnapshotUrl = null;
    this.menuOpen = false;
    this.modalOpen = true;
  }

  _closeModal() {
    this.modalOpen = false;
    this.selectedVideoUrl = null;
    this.selectedVideoMediaContentId = null;
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
        return { path: item, name: fallbackName, recursive: false };
      }
      const path = item.path || item.entity || item.media_source || item.source || '';
      const fallbackName = decodeURIComponent(path.split('/').filter(Boolean).pop() || `Camera ${index + 1}`);
      return {
        path: path,
        name: item.name || fallbackName,
        recursive: !!item.recursive,
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
    if (this.resources === undefined && !this._loading) {
      this._loadResources(this._hass);
    }
  }

  getCardSize() {
    return 3;
  }

  _isImageExtension(extension) {
    if (!extension) return true;
    return !!extension.match(/(jpeg|jpg|gif|png|tiff|bmp)$/i);
  }

  _isVideoUrl(url) {
    if (!url) return false;
    const ext = url.split('?')[0].split('#')[0].split('.').pop();
    return !this._isImageExtension(ext);
  }

  async _selectResource(index) {
    this.menuOpen = false;

    if (!this.resources || this.resources.length === 0) return;

    if (index < 0 || index >= this.resources.length) return;

    this.currentResourceIndex = index;

    const currentRes = this._currentResource();
    if (currentRes) {
      if (!currentRes.url && currentRes.media_content_id) {
        await this._resolveResourceUrl(currentRes);
      }
      if (currentRes.snapshots) {
        currentRes.snapshots.forEach((s) => this._resolveResourceUrl(s));
      }
      if (currentRes.videos) {
        currentRes.videos.forEach((v) => this._resolveResourceUrl(v));
      }

      this.selectedVideoUrl = null;
      this.selectedVideoMediaContentId = null;
      this.selectedSnapshotUrl = currentRes.url;
      this.requestUpdate();
    }

    this._preloadAhead(this.currentResourceIndex, 20);
  }

  _getResource(index) {
    if (this.resources !== undefined && index !== undefined && this.resources.length > 0) {
      return this.resources[index];
    }
    return {
      url: '',
      name: '',
      extension: 'jpg',
      caption: '',
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
    this._loading = true;
    this.requestUpdate();

    for (const entity of this.entityConfigs) {
      if (entity.path.substring(0, 15).toLowerCase() === 'media-source://') {
        commands.push(this._loadMediaResource(hass, entity));
      }
    }

    Promise.all(commands)
      .then((resources) => {
        this._allRawResources = resources.filter((result) => !result.error).flat(Number.POSITIVE_INFINITY);
        this._loading = false;
        this._updateFilteredResources();
      })
      .catch((err) => {
        console.error('Fout bij laden van resources:', err);
        this._loading = false;
        this.requestUpdate();
      });
  }

  _updateFilteredResources() {
    if (!this._allRawResources) return;
    let filtered = this._allRawResources;

    if (this.selectedEntityFilter && this.selectedEntityFilter !== 'all') {
      filtered = filtered.filter((r) => r.entityPath === this.selectedEntityFilter);
    }

    if (this.selectedStartDateTime && this.selectedEndDateTime) {
      const startMs = dayjs(this.selectedStartDateTime).valueOf();
      const endMs = dayjs(this.selectedEndDateTime).valueOf();

      filtered = filtered.filter((r) => {
        return r.timestamp >= startMs && r.timestamp <= endMs;
      });
    }

    this.resources = this._groupReolinkMedia(filtered);

    if (this.resources.length > 0) {
      this._selectResource(0);
    } else {
      this.currentResourceIndex = 0;
      this.selectedVideoUrl = null;
      this.selectedVideoMediaContentId = null;
      this.selectedSnapshotUrl = null;
      this.requestUpdate();
    }
  }

  _parseTimestamp(fileName) {
    if (this.config.file_name_format) {
      const d = dayjs(fileName, this.config.file_name_format);
      if (d.isValid()) return d.valueOf();
    }

    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    const match = nameWithoutExt.match(/(\d{8})_?(\d{6})$/) || nameWithoutExt.match(/(\d{14})/);

    if (match) {
      const tsStr = match[2] ? match[1] + match[2] : match[1];
      const d = dayjs(tsStr, 'YYYYMMDDHHmmss');
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
        timestamp: item.timestamp || this._parseTimestamp(item.name),
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
        const isNearVideo = event.videos.some((vid) => Math.abs(snap.timestamp - vid.timestamp) <= eventIntervalMs);

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
            media_content_id: snap.media_content_id,
            url: snap.url || null,
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
          media_content_id: firstVideo.media_content_id,
          url: firstVideo.url || null,
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
      this._loadMedia(hass, entity.path, entity.recursive)
        .then((items) => {
          const resources = items
            .map((item) => {
              const res = this._createFileResourceFromItem(item);
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

  async _browseMediaCached(hass, contentId) {
    if (this._mediaBrowseCache.has(contentId)) {
      return this._mediaBrowseCache.get(contentId);
    }
    try {
      const result = await hass.callWS({ type: 'media_source/browse_media', media_content_id: contentId });
      const children = result.children || [];
      this._mediaBrowseCache.set(contentId, children);
      return children;
    } catch (e) {
      console.error('Fout bij ophalen media:', e);
      return [];
    }
  }

  _shouldSkipFolder(folderTitle, startMs, endMs) {
    if (!startMs || !endMs || !folderTitle) return false;

    const cleanTitle = folderTitle.trim();
    let folderStart = null;
    let folderEnd = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanTitle) || /^\d{8}$/.test(cleanTitle)) {
      const d = dayjs(cleanTitle.replace(/-/g, ''), 'YYYYMMDD');
      if (d.isValid()) {
        folderStart = d.startOf('day').valueOf();
        folderEnd = d.endOf('day').valueOf();
      }
    } else if (/^\d{4}-\d{2}$/.test(cleanTitle) || /^\d{6}$/.test(cleanTitle)) {
      const d = dayjs(cleanTitle.replace(/-/g, ''), 'YYYYMM');
      if (d.isValid()) {
        folderStart = d.startOf('month').valueOf();
        folderEnd = d.endOf('month').valueOf();
      }
    } else if (/^\d{4}$/.test(cleanTitle)) {
      const d = dayjs(cleanTitle, 'YYYY');
      if (d.isValid()) {
        folderStart = d.startOf('year').valueOf();
        folderEnd = d.endOf('year').valueOf();
      }
    }

    if (folderStart && folderEnd) {
      if (folderEnd < startMs || folderStart > endMs) {
        return true;
      }
    }

    return false;
  }

  async _loadMedia(hass, contentId, recursive = false) {
    const children = await this._browseMediaCached(hass, contentId);
    let files = [];
    const subPromises = [];

    const startMs = this.selectedStartDateTime ? dayjs(this.selectedStartDateTime).valueOf() : null;
    const endMs = this.selectedEndDateTime ? dayjs(this.selectedEndDateTime).valueOf() : null;

    for (const item of children) {
      const isDirectory = item.can_expand || item.media_class === 'directory';
      const isMedia = item.media_class === 'image' || item.media_class === 'video';

      if (isMedia) {
        files.push(item);
      } else if (recursive && isDirectory) {
        if (this._shouldSkipFolder(item.title, startMs, endMs)) {
          continue;
        }
        subPromises.push(this._loadMedia(hass, item.media_content_id, true));
      }
    }

    if (subPromises.length > 0) {
      const subResults = await Promise.all(subPromises);
      files = files.concat(subResults.flat());
    }

    return files;
  }

  _createFileResourceFromItem(item) {
    const rawPath = item.media_content_id || item.title || '';
    const cleanPath = rawPath.split('?')[0];
    const fileName = item.title && item.title.includes('.') ? item.title : decodeURIComponent(cleanPath.split('/').at(-1));
    const extension = fileName.split('.').at(-1).toLowerCase();
    const timestamp = this._parseTimestamp(fileName);

    return {
      media_content_id: item.media_content_id,
      url: null,
      name: fileName,
      extension: extension,
      caption: fileName,
      timestamp: timestamp,
    };
  }

  _resolveResourceUrl(res) {
    if (!res) return Promise.resolve(null);
    if (res.url) return Promise.resolve(res.url);

    if (this._urlCache.has(res.media_content_id)) {
      res.url = this._urlCache.get(res.media_content_id);
      return Promise.resolve(res.url);
    }

    if (this._pendingResolves.has(res.media_content_id)) {
      return this._pendingResolves.get(res.media_content_id);
    }

    const promise = this._hass
      .callWS({
        type: 'media_source/resolve_media',
        media_content_id: res.media_content_id,
        expires: 10800,
      })
      .then((auth) => {
        res.url = auth.url;
        this._urlCache.set(res.media_content_id, auth.url);
        this._pendingResolves.delete(res.media_content_id);
        return auth.url;
      })
      .catch((err) => {
        console.error('Fout bij resolven van media URL:', err);
        this._pendingResolves.delete(res.media_content_id);
        return null;
      });

    this._pendingResolves.set(res.media_content_id, promise);
    return promise;
  }

  _preloadAhead(startIndex, amount = 20) {
    if (!this.resources || this.resources.length === 0) return;

    for (let i = startIndex; i < startIndex + amount && i < this.resources.length; i++) {
      const res = this.resources[i];
      if (!res) continue;

      this._resolveResourceUrl(res).then((url) => {
        if (url && this._isImageExtension(res.extension) && !this._imageCache.has(url)) {
          const img = new Image();
          img.src = url;
          if (img.decode) {
            img.decode().catch(() => {});
          }
          this._imageCache.set(url, img);
        }
      });
    }
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
        background: var(--ha-card-background, var(--card-background-color, #ffffff));
        color: var(--primary-text-color, #212121);
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
        background: var(--secondary-background-color, #e0e0e0);
        width: 100%;
        min-height: 250px;
      }
      .placeholder-text {
        color: var(--secondary-text-color, #727272);
        font-size: 14px;
        font-weight: 500;
        padding: 20px;
        text-align: center;
        pointer-events: auto;
      }
      .no-media-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-height: 250px;
        background: #000;
      }
      .no-media-box .placeholder-text {
        color: rgba(255, 255, 255, 0.85);
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
        background: rgba(0, 0, 0, 0.05);
        text-align: center;
        min-height: 20px;
      }
      .caption-text {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.3;
        color: var(--primary-text-color, #212121);
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
        transition: opacity 0.2s ease;
      }
      .btn-left {
        left: 10px;
      }
      .btn-right {
        right: 10px;
      }
      .btn[disabled],
      .btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
        pointer-events: none;
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
      .btn-timelapse[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-timelapse.active {
        background: #e53935;
      }

      .main-dropdown-container {
        position: relative;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        background: rgba(0, 0, 0, 0.05);
      }

      .ha-energy-date-bar {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--secondary-background-color, #f1f1f1);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 20px;
        padding: 0 6px;
        height: 32px;
        box-sizing: border-box;
      }
      .date-display-btn {
        background: transparent;
        border: none;
        color: var(--primary-text-color, #212121);
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 14px;
      }
      .date-display-btn:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
      }
      .date-display-btn ha-icon {
        --mdc-icon-size: 18px;
        color: var(--primary-text-color, #212121);
      }

      .icon-nav-btn {
        background: transparent;
        border: none;
        color: var(--primary-text-color, #212121);
        font-size: 14px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 50%;
      }
      .icon-nav-btn:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
      }

      .date-picker-popover {
        position: absolute;
        top: 38px;
        right: 0;
        background: var(--ha-card-background, var(--card-background-color, #ffffff));
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        padding: 12px;
        z-index: 150;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 260px;
      }
      .popover-presets {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .popover-presets button {
        background: var(--secondary-background-color, #f5f5f5);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        color: var(--primary-text-color, #212121);
        padding: 6px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
      }
      .popover-presets button:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.1));
      }
      .popover-custom-range {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .field-group label {
        font-size: 11px;
        color: var(--secondary-text-color, #727272);
      }
      .field-group input {
        background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
        border-radius: 6px;
        padding: 6px;
        font-size: 12px;
        outline: none;
      }
      .popover-actions {
        display: flex;
        justify-content: flex-end;
      }
      .btn-apply {
        background: var(--primary-color, #03a9f4);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      }

      .entity-dropdown {
        background: var(--secondary-background-color, #f1f1f1);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
        border-radius: 18px;
        padding: 0 10px;
        height: 32px;
        box-sizing: border-box;
        font-size: 12px;
        cursor: pointer;
        outline: none;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
      }
      .entity-dropdown option {
        background: var(--ha-card-background, var(--card-background-color, #ffffff));
        color: var(--primary-text-color, #212121);
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

        --secondary-background-color: rgba(255, 255, 255, 0.08);
        --primary-text-color: #ffffff;
        --secondary-text-color: rgba(255, 255, 255, 0.7);
        --divider-color: rgba(255, 255, 255, 0.2);
        --ha-card-background: #2b2b2b;
        --card-background-color: #2b2b2b;
        --input-fill-color: rgba(255, 255, 255, 0.08);
        color-scheme: dark;
      }

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

      @media (max-width: 768px) {
        .modal-top-bar {
          justify-content: flex-end;
        }
        .modal-top-bar .dropdown-group {
          display: none;
        }
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
        background: var(--ha-card-background, var(--card-background-color, #222));
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
        color: var(--primary-text-color, #ffffff);
        text-decoration: none;
        font-size: 13px;
        cursor: pointer;
      }
      .menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .menu-item ha-icon {
        --mdc-icon-size: 20px;
        color: var(--primary-text-color, #ffffff);
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