import { LitElement, html, css } from 'lit-element';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

const ReolinkGalleryCardVersion = '1.3.5';

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
      isPlayingTimelapse: {},
      selectedEntityFilter: {},
      selectedStartDateTime: {},
      selectedEndDateTime: {},
      showDatePickerModal: {},
      showDownloadMenu: {},
      showEntityMenu: {},
      showMediaMenu: {},
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
    this.isPlayingTimelapse = false;
    this.timelapseTimer = null;
    this.selectedEntityFilter = null;
    this.showDatePickerModal = false;
    this.showDownloadMenu = false;
    this.showEntityMenu = false;
    this.showMediaMenu = false;
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
    this._handleOutsideClick = this._handleOutsideClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('click', this._handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('click', this._handleOutsideClick);
    this._stopTimelapse();
  }

  _handleOutsideClick(event) {
    const path = event.composedPath ? event.composedPath() : [];

    const isDatePicker = path.some((el) => el.classList && (el.classList.contains('ha-energy-date-bar') || el.classList.contains('date-picker-popover')));
    if (!isDatePicker && this.showDatePickerModal) {
      this.showDatePickerModal = false;
    }

    const isDownloadMenu = path.some((el) => el.classList && (el.classList.contains('download-container') || el.classList.contains('download-menu-popover')));
    if (!isDownloadMenu && this.showDownloadMenu) {
      this.showDownloadMenu = false;
    }

    const isEntityMenu = path.some((el) => el.classList && (el.classList.contains('entity-menu-container') || el.classList.contains('custom-dropdown-popover')));
    if (!isEntityMenu && this.showEntityMenu) {
      this.showEntityMenu = false;
    }

    const isMediaMenu = path.some((el) => el.classList && (el.classList.contains('media-menu-container') || el.classList.contains('custom-dropdown-popover')));
    if (!isMediaMenu && this.showMediaMenu) {
      this.showMediaMenu = false;
    }
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
        download: 'Downloaden',
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
        download: 'Download',
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
        download: 'Herunterladen',
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
        download: 'Télécharger',
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

  _handleEntityFilterChange(path) {
    this.selectedEntityFilter = path;
    this.showEntityMenu = false;
    this._updateFilteredResources();
  }

  _triggerDownload(url) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.target = '_blank';
    a.click();
    this.showDownloadMenu = false;
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

    const isSameRange = (startRef, endRef) => Math.abs(s.diff(startRef, 'minute')) <= 1 && Math.abs(e.diff(endRef, 'minute')) <= 1;

    if (isSameRange(todayStart, todayEnd)) return this._t('today');
    if (isSameRange(yesterdayStart, yesterdayEnd)) return this._t('yesterday');
    if (isSameRange(eergisterenStart, eergisterenEnd)) return this._t('dayBeforeYesterday');
    if (isSameRange(now.subtract(7, 'day').startOf('day'), todayEnd)) return this._t('last7days');
    if (isSameRange(now.subtract(1, 'month').startOf('day'), todayEnd)) return this._t('lastMonth');

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

    const currentEntity = this.entityConfigs.find((e) => e.path === this.selectedEntityFilter);
    const currentEntityName = currentEntity ? currentEntity.name : (this.selectedEntityFilter === 'all' ? this._t('all') : '');

    return html`
      <div class="entity-menu-container">
        <button
          class="btn-custom-dropdown"
          @click="${() => {
            this.showEntityMenu = !this.showEntityMenu;
            this.showMediaMenu = false;
            this.showDownloadMenu = false;
          }}"
        >
          <span>${currentEntityName}</span>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </button>

        ${this.showEntityMenu
          ? html`
              <div class="custom-dropdown-popover">
                ${this.entityConfigs.map((entity) => html`
                  <button
                    class="custom-dropdown-item ${this.selectedEntityFilter === entity.path ? 'selected' : ''}"
                    @click="${() => this._handleEntityFilterChange(entity.path)}"
                  >
                    <span>${entity.name}</span>
                  </button>
                `)}
                <button
                  class="custom-dropdown-item ${this.selectedEntityFilter === 'all' ? 'selected' : ''}"
                  @click="${() => this._handleEntityFilterChange('all')}"
                >
                  <span>${this._t('all')}</span>
                </button>
              </div>
            `
          : html``}
      </div>
    `;
  }

  _renderDateFilterBar(inModal = false) {
    const maxDateTime = dayjs().endOf('day').format('YYYY-MM-DDTHH:mm');
    const shouldShowPopover = this.showDatePickerModal && (inModal ? this.modalOpen : !this.modalOpen);
    
    const nextDayStart = dayjs(this.selectedStartDateTime).add(1, 'day');
    const isAtFutureLimit = nextDayStart.isAfter(dayjs().endOf('day'));

    return html`
      <div class="ha-energy-date-bar">
        <button
          class="icon-nav-btn"
          aria-label="Vorige dag"
          @click="${() => {
            this._shiftDay(-1);
          }}"
        >
          &lt;
        </button>

        <button
          class="date-display-btn"
          @click="${() => {
            this.showDatePickerModal = !this.showDatePickerModal;
          }}"
        >
          <ha-icon icon="mdi:calendar-month"></ha-icon>
          <span>${this._formatLabelDate()}</span>
        </button>

        <button
          class="icon-nav-btn"
          aria-label="Volgende dag"
          ?disabled="${isAtFutureLimit}"
          @click="${() => {
            this._shiftDay(1);
          }}"
        >
          &gt;
        </button>

        ${shouldShowPopover
          ? html`
              <div class="date-picker-popover">
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

  _handleModalBackdropClick(e) {
    if (e.target && e.target.id === 'videoModal') {
      this._closeModal();
    }
  }

  _renderCaptionBadges(captionText) {
    if (!captionText) return html``;
    const parts = captionText.split(' - ');
    const hasSplit = parts.length >= 2;

    return html`
      <div class="caption-badges-wrapper">
        ${hasSplit ? html`<span class="caption-badge">${parts[0]}</span>` : html``}
        <span class="caption-badge">${hasSplit ? parts.slice(1).join(' - ') : captionText}</span>
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
      <ha-card style="color-scheme: ${colorScheme};">
        <div class="resource-viewer" @touchstart="${(event) => this._handleTouchStart(event)}" @touchend="${(event) => this._handleTouchEnd(event)}">
          <div class="main-dropdown-container">${this._renderEntityDropdown()} ${this._renderDateFilterBar(false)}</div>

          <div class="media-container" @click="${() => this._openModal()}">
            ${isLoading ? html`<div class="placeholder-text">${this._t('loading')}</div>` : !hasResources ? html`<div class="no-media-box"><span class="placeholder-text">${this._t('no_media')}</span></div>` : activeSnapshotUrl ? (activeIsVideoFrame ? html`<video class="thumb-video-frame" preload="metadata" muted playsinline src="${activeSnapshotUrl}#t=0.5"></video>` : html`<img src="${activeSnapshotUrl}" />`) : html`<div class="placeholder-text">${this._t('loading')}</div>`}
          </div>

          <figcaption class="caption-bar">${this._renderCaptionBadges(currentRes.caption)}</figcaption>
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
              <div id="videoModal" class="modal" @click="${(e) => this._handleModalBackdropClick(e)}">
                <div class="video-modal-container">
                  <div class="modal-top-bar">
                    <div class="dropdown-group">${this._renderEntityDropdown()} ${this._renderDateFilterBar(true)}</div>

                    <div class="action-group">
                      ${hasSnapshots || hasVideos
                        ? html`
                            <div class="download-container">
                              <button
                                class="btn-download-menu"
                                title="${this._t('download')}"
                                @click="${() => {
                                  this.showDownloadMenu = !this.showDownloadMenu;
                                  this.showEntityMenu = false;
                                  this.showMediaMenu = false;
                                }}"
                              >
                                <ha-icon icon="mdi:dots-vertical"></ha-icon>
                              </button>

                              ${this.showDownloadMenu
                                ? html`
                                    <div class="download-menu-popover">
                                      <div class="download-menu-header">${this._t('download')}</div>
                                      ${currentRes.snapshots.map((img, i) => html`
                                        <button class="download-menu-item" @click="${() => this._triggerDownload(img.url)}">
                                          <ha-icon icon="mdi:camera"></ha-icon>
                                          <span>${hasMultipleSnapshots ? `${this._t('snapshot')} ${i + 1}` : this._t('snapshot')}</span>
                                        </button>
                                      `)}
                                      ${currentRes.videos.map((vid, i) => html`
                                        <button class="download-menu-item" @click="${() => this._triggerDownload(vid.url)}">
                                          <ha-icon icon="mdi:video"></ha-icon>
                                          <span>${hasMultipleVideos ? `${this._t('video')} ${i + 1}` : this._t('video')}</span>
                                        </button>
                                      `)}
                                    </div>
                                  `
                                : html``}
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

                  <div class="modal-header-info">${this._renderCaptionBadges(currentRes.caption)}</div>

                  ${hasResources
                    ? html`
                        <div class="video-selector-bar">
                          ${!this.isPlayingTimelapse && (hasSnapshots || hasVideos)
                            ? (() => {
                                let selectedMediaValue = '';
                                let selectedMediaLabel = this._t('snapshot');
                                if (this.selectedVideoUrl || this.selectedVideoMediaContentId) {
                                  const vidIdx = currentRes.videos ? currentRes.videos.findIndex((vid) => (vid.url && vid.url === this.selectedVideoUrl) || (this.selectedVideoMediaContentId && vid.media_content_id === this.selectedVideoMediaContentId)) : -1;
                                  if (vidIdx !== -1) {
                                    selectedMediaValue = `vid-${vidIdx}`;
                                    selectedMediaLabel = hasMultipleVideos ? `${this._t('video')} ${vidIdx + 1}` : this._t('video');
                                  }
                                }

                                if (!selectedMediaValue && currentRes.snapshots && currentRes.snapshots.length > 0) {
                                  const snapIdx = currentRes.snapshots.findIndex((img) => img === activeSnapshot || (img.url && img.url === activeSnapshotUrl) || (img.media_content_id && activeSnapshot && img.media_content_id === activeSnapshot.media_content_id));
                                  const idx = snapIdx !== -1 ? snapIdx : 0;
                                  selectedMediaValue = `snap-${idx}`;
                                  selectedMediaLabel = hasMultipleSnapshots ? `${this._t('snapshot')} ${idx + 1}` : this._t('snapshot');
                                }

                                return html`
                                  <div class="media-menu-container">
                                    <button
                                      class="btn-media-selector"
                                      @click="${() => {
                                        this.showMediaMenu = !this.showMediaMenu;
                                        this.showEntityMenu = false;
                                        this.showDownloadMenu = false;
                                      }}"
                                    >
                                      <span>${selectedMediaLabel}</span>
                                      <ha-icon icon="mdi:chevron-down"></ha-icon>
                                    </button>

                                    ${this.showMediaMenu
                                      ? html`
                                          <div class="custom-dropdown-popover">
                                            ${hasSnapshots ? currentRes.snapshots.map((_, i) => html`
                                              <button
                                                class="custom-dropdown-item ${selectedMediaValue === `snap-${i}` ? 'selected' : ''}"
                                                @click="${() => this._handleMediaSelection(`snap-${i}`, currentRes)}"
                                              >
                                                <ha-icon icon="mdi:camera"></ha-icon>
                                                <span>${hasMultipleSnapshots ? `${this._t('snapshot')} ${i + 1}` : this._t('snapshot')}</span>
                                              </button>
                                            `) : html``}
                                            ${hasVideos ? currentRes.videos.map((_, i) => html`
                                              <button
                                                class="custom-dropdown-item ${selectedMediaValue === `vid-${i}` ? 'selected' : ''}"
                                                @click="${() => this._handleMediaSelection(`vid-${i}`, currentRes)}"
                                              >
                                                <ha-icon icon="mdi:video"></ha-icon>
                                                <span>${hasMultipleVideos ? `${this._t('video')} ${i + 1}` : this._t('video')}</span>
                                              </button>
                                            `) : html``}
                                          </div>
                                        `
                                      : html``}
                                  </div>
                                `;
                              })()
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

  async _handleMediaSelection(val, currentRes) {
    this.showMediaMenu = false;
    if (!val) return;

    const [type, indexStr] = val.split('-');
    const index = parseInt(indexStr, 10);

    if (type === 'snap' && currentRes.snapshots && currentRes.snapshots[index]) {
      const img = currentRes.snapshots[index];
      if (!img.url) await this._resolveResourceUrl(img);
      this.selectedVideoUrl = null;
      this.selectedVideoMediaContentId = null;
      this.selectedSnapshotUrl = img.url;
      this.requestUpdate();
    } else if (type === 'vid' && currentRes.videos && currentRes.videos[index]) {
      const vid = currentRes.videos[index];
      if (!vid.url) await this._resolveResourceUrl(vid);
      this.selectedVideoMediaContentId = vid.media_content_id;
      this._handleVideoClick(vid);
    }
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
    this.modalOpen = true;
  }

  _closeModal() {
    this.modalOpen = false;
    this.selectedVideoUrl = null;
    this.selectedVideoMediaContentId = null;
    this.selectedSnapshotUrl = null;
    this.showDownloadMenu = false;
    this.showEntityMenu = false;
    this.showMediaMenu = false;
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
        background: transparent;
        display: flex;
        justify-content: center;
      }

      .caption-badges-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .caption-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.3px;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
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
      .btn-timelapse,
      .btn-play-video,
      .btn-media-selector {
        background: var(--primary-color, #03a9f4);
        color: #fff;
        border: none;
        height: 36px;
        padding: 0 16px;
        border-radius: 18px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        box-sizing: border-box;
        outline: none;
        font-family: inherit;
        transition: background 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
      }
      .btn-timelapse ha-icon,
      .btn-play-video ha-icon,
      .btn-media-selector ha-icon {
        --mdc-icon-size: 18px;
      }
      .btn-timelapse:hover,
      .btn-play-video:hover,
      .btn-media-selector:hover {
        filter: brightness(0.92);
      }
      .btn-timelapse[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
      .btn-timelapse.active,
      .btn-play-video.active {
        background: #e53935;
        box-shadow: 0 0 8px rgba(229, 57, 53, 0.5);
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
        justify-content: space-between;
        gap: 4px;
        background: var(--secondary-background-color, #f1f1f1);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 20px;
        padding: 0 4px;
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
        padding: 4px 6px;
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
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        touch-action: manipulation;
      }
      .icon-nav-btn:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
      }
      .icon-nav-btn[disabled],
      .icon-nav-btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
        pointer-events: none;
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

      /* Custom Dropdown / Popover Menus (Home Assistant style) */
      .entity-menu-container,
      .media-menu-container {
        position: relative;
      }

      .btn-custom-dropdown {
        background-color: var(--secondary-background-color, #f1f1f1);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 18px;
        padding: 0 12px 0 16px;
        height: 32px;
        box-sizing: border-box;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        outline: none;
        font-family: inherit;
        transition: background 0.2s ease;
      }
      .btn-custom-dropdown:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
      }
      .btn-custom-dropdown ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color, #727272);
      }

      .custom-dropdown-popover {
        position: absolute;
        top: 38px;
        left: 0;
        background: var(--ha-card-background, var(--card-background-color, #ffffff));
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        padding: 6px;
        z-index: 200;
        display: flex;
        flex-direction: column;
        min-width: 160px;
      }
      .media-menu-container .custom-dropdown-popover {
        top: 42px;
      }

      .custom-dropdown-item {
        background: transparent;
        border: none;
        color: var(--primary-text-color, #212121);
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: left;
        width: 100%;
        box-sizing: border-box;
      }
      .custom-dropdown-item:hover {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
      }
      .custom-dropdown-item.selected {
        font-weight: bold;
        color: var(--primary-color, #03a9f4);
      }
      .custom-dropdown-item ha-icon {
        --mdc-icon-size: 16px;
        color: var(--secondary-text-color, #727272);
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
        color-scheme: dark;
      }

      .video-modal-container .caption-badge {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .video-modal-container .ha-energy-date-bar,
      .video-modal-container .btn-custom-dropdown {
        background-color: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }
      .video-modal-container .date-display-btn,
      .video-modal-container .icon-nav-btn,
      .video-modal-container .date-display-btn ha-icon,
      .video-modal-container .btn-custom-dropdown ha-icon {
        color: #ffffff;
      }
      .video-modal-container .btn-custom-dropdown:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .video-modal-container .custom-dropdown-popover {
        background: #2b2b2b;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
      }
      .video-modal-container .custom-dropdown-item {
        color: #ffffff;
      }
      .video-modal-container .custom-dropdown-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .video-modal-container .custom-dropdown-item.selected {
        color: var(--primary-color, #03a9f4);
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

      .btn-close-x {
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .btn-close-x:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .download-container {
        position: relative;
      }

      .btn-download-menu {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        padding: 0;
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none;
        transition: background 0.2s ease;
      }
      .btn-download-menu:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .btn-download-menu ha-icon {
        --mdc-icon-size: 20px;
      }

      .download-menu-popover {
        position: absolute;
        top: 42px;
        right: 0;
        background: #2b2b2b;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        padding: 6px;
        z-index: 200;
        display: flex;
        flex-direction: column;
        min-width: 160px;
      }

      .download-menu-header {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        padding: 6px 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 4px;
      }

      .download-menu-item {
        background: transparent;
        border: none;
        color: #ffffff;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: left;
        width: 100%;
        box-sizing: border-box;
      }
      .download-menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .download-menu-item ha-icon {
        --mdc-icon-size: 16px;
        color: rgba(255, 255, 255, 0.8);
      }

      .modal-header-info {
        width: 100%;
        display: flex;
        justify-content: center;
        padding: 10px 0 4px 0;
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

      .video-selector-bar {
        display: flex;
        justify-content: center;
        align-items: center;
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
