(function () {
  "use strict";

  var STORAGE_KEY = "exerciseVideoId";
  var VIDEO_RATIO = 16 / 9;

  var stage = document.getElementById("stage");
  var playerWrap = document.getElementById("playerWrap");
  var tapCatcher = document.getElementById("tapCatcher");
  var settingsBtn = document.getElementById("settingsBtn");
  var setup = document.getElementById("setup");
  var videoInput = document.getElementById("videoInput");
  var setupError = document.getElementById("setupError");
  var saveBtn = document.getElementById("saveBtn");

  var player = null;
  var settingsFadeTimer = null;
  var wakeLock = null;
  var introCover = document.getElementById("introCover");
  var introCoverTimer = null;
  var INTRO_COVER_MS = 4500;

  var DOUBLE_TAP_MS = 300;
  var SEEK_SECONDS = 10;
  var lastTapTime = 0;
  var lastTapZone = null;
  var singleTapTimer = null;
  var seekLeftIndicator = document.getElementById("seekLeftIndicator");
  var seekRightIndicator = document.getElementById("seekRightIndicator");
  var seekFadeTimers = { left: null, right: null };

  function extractVideoId(raw) {
    var input = (raw || "").trim();
    if (!input) return null;
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      var url = new URL(input);
      var host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        var id = url.pathname.slice(1).split("/")[0];
        return id || null;
      }
      if (host === "youtube.com" || host === "m.youtube.com") {
        if (url.pathname === "/watch") return url.searchParams.get("v");
        var shorts = url.pathname.match(/\/shorts\/([\w-]{11})/);
        if (shorts) return shorts[1];
        var embed = url.pathname.match(/\/embed\/([\w-]{11})/);
        if (embed) return embed[1];
      }
    } catch (e) {
      // not a parseable URL
    }
    return null;
  }

  function getSavedVideoId() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveVideoId(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      // ignore, e.g. private mode storage limits
    }
  }

  function sizePlayer() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    var pw, ph;
    if (w / h > VIDEO_RATIO) {
      // Screen wider than the video: fit by height, bars left/right.
      ph = h;
      pw = h * VIDEO_RATIO;
    } else {
      // Screen taller/narrower than the video: fit by width, bars top/bottom.
      pw = w;
      ph = w / VIDEO_RATIO;
    }
    playerWrap.style.width = pw + "px";
    playerWrap.style.height = ph + "px";
  }

  function showSetup(prefill) {
    videoInput.value = prefill || "";
    setupError.classList.add("hidden");
    setup.classList.remove("hidden");
    setTimeout(function () {
      videoInput.focus();
    }, 50);
  }

  function hideSetup() {
    setup.classList.add("hidden");
  }

  function flashSettingsButton() {
    settingsBtn.classList.add("visible");
    if (settingsFadeTimer) clearTimeout(settingsFadeTimer);
    settingsFadeTimer = setTimeout(function () {
      settingsBtn.classList.remove("visible");
    }, 2500);
  }

  function showIntroCoverBriefly() {
    if (!introCover) return;
    introCover.classList.remove("hidden");
    if (introCoverTimer) clearTimeout(introCoverTimer);
    introCoverTimer = setTimeout(function () {
      introCover.classList.add("hidden");
    }, INTRO_COVER_MS);
  }

  function togglePlayPause() {
    if (!player || typeof player.getPlayerState !== "function") return;
    var state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function showSeekIndicator(zone) {
    var el = zone === "left" ? seekLeftIndicator : seekRightIndicator;
    el.classList.add("visible");
    if (seekFadeTimers[zone]) clearTimeout(seekFadeTimers[zone]);
    seekFadeTimers[zone] = setTimeout(function () {
      el.classList.remove("visible");
    }, 500);
  }

  function seek(zone) {
    if (!player || typeof player.getCurrentTime !== "function") return;
    var delta = zone === "right" ? SEEK_SECONDS : -SEEK_SECONDS;
    var duration = player.getDuration ? player.getDuration() : 0;
    var target = player.getCurrentTime() + delta;
    if (target < 0) target = 0;
    if (duration && target > duration) target = duration;
    player.seekTo(target, true);
    showSeekIndicator(zone);
  }

  function handleTap(zone) {
    var now = Date.now();
    if (zone === lastTapZone && now - lastTapTime < DOUBLE_TAP_MS) {
      if (singleTapTimer) {
        clearTimeout(singleTapTimer);
        singleTapTimer = null;
      }
      lastTapTime = 0;
      lastTapZone = null;
      seek(zone);
      return;
    }
    lastTapTime = now;
    lastTapZone = zone;
    singleTapTimer = setTimeout(function () {
      togglePlayPause();
      flashSettingsButton();
      singleTapTimer = null;
    }, DOUBLE_TAP_MS);
  }

  var nosleepVideo = document.getElementById("nosleepVideo");

  function startNoSleepVideo() {
    // iOS ignores the Wake Lock API in standalone home-screen apps in some
    // versions, but keeps the screen on while a native <video> is playing.
    // This silent looping video is a fallback for that case.
    if (!nosleepVideo) return;
    var p = nosleepVideo.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        // ignore, will retry on the next tap/visibilitychange
      });
    }
  }

  function requestWakeLock() {
    startNoSleepVideo();
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock
      .request("screen")
      .then(function (lock) {
        wakeLock = lock;
        lock.addEventListener("release", function () {
          wakeLock = null;
        });
      })
      .catch(function () {
        // ignore, e.g. not allowed in this context
      });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") requestWakeLock();
  });

  if (nosleepVideo) {
    nosleepVideo.addEventListener("pause", function () {
      if (document.visibilityState === "visible") startNoSleepVideo();
    });
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
      onYouTubeIframeAPIReady();
      return;
    }
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    var videoId = getSavedVideoId();
    if (!videoId) return;
    createPlayer(videoId);
  };

  function createPlayer(videoId) {
    sizePlayer();
    if (player && typeof player.loadVideoById === "function") {
      player.loadVideoById(videoId);
      showIntroCoverBriefly();
      return;
    }
    player = new YT.Player("player", {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        mute: 1,
        loop: 1,
        playlist: videoId,
        origin: window.location.origin,
      },
      events: {
        onReady: function (e) {
          e.target.mute();
          e.target.playVideo();
          requestWakeLock();
          showIntroCoverBriefly();
        },
      },
    });
  }

  function startWithVideoId(videoId) {
    hideSetup();
    loadYouTubeApi();
    if (window.YT && window.YT.Player) createPlayer(videoId);
  }

  saveBtn.addEventListener("click", function () {
    var id = extractVideoId(videoInput.value);
    if (!id) {
      setupError.textContent =
        "Das sieht nicht nach einem gültigen YouTube-Link aus. Bitte den Link nochmal prüfen.";
      setupError.classList.remove("hidden");
      return;
    }
    saveVideoId(id);
    startWithVideoId(id);
  });

  settingsBtn.addEventListener("click", function () {
    var current = getSavedVideoId();
    showSetup(current ? "https://youtu.be/" + current : "");
  });

  tapCatcher.addEventListener("click", function (e) {
    var rect = tapCatcher.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var zone = x < rect.width / 2 ? "left" : "right";
    handleTap(zone);
    requestWakeLock();
  });

  window.addEventListener("resize", sizePlayer);
  window.addEventListener("orientationchange", sizePlayer);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  var savedId = getSavedVideoId();
  if (savedId) {
    loadYouTubeApi();
  } else {
    showSetup("");
  }
})();
