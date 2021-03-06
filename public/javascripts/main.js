var socket = io();
var sounds = {};
var muteEl = document.querySelectorAll('.mute')[0];
var speechEl = document.querySelectorAll('.input-speech')[0];
var selectEl = document.querySelectorAll('.select-voice')[0];
var speechLogEl = document.querySelectorAll('.textarea-speech-log')[0];
var voicesLoaded = false;
var room = window.location.pathname.split('/').pop();

function shake(el) {
  el.classList.add('shake');
  setTimeout(function() {
    el.classList.remove('shake');
  }, 500);
}

//check to make sure speech is supported
if(window.speechSynthesis) {
  // wait on voices to be loaded before fetching list (loaded async)
  window.speechSynthesis.onvoiceschanged = function() {
    if (voicesLoaded) return;

    voicesLoaded = true;
    window.speechSynthesis.getVoices().forEach(function(voice) {
      var option = document.createElement("option");
      option.text = voice.name;
      option.value = voice.name;
      option.selected = voice.default;
      selectEl.appendChild(option);
    });
  };

  socket.on('speech', function(data) {
    var msg = data.message;
    var msgVoice = data.voice;

    if (!msg.length) return;

    if (!muteEl.checked) {
      var utterance = new SpeechSynthesisUtterance(msg);
      utterance.voice = speechSynthesis
                          .getVoices()
                          .filter(function(voice) {
                            return voice.name === msgVoice;
                          })[0];
      window.speechSynthesis.speak(utterance);
    }

    speechLogEl.value = speechLogEl.value + '(' + msgVoice + ' ' + new Date().toLocaleTimeString() + ') ' + msg + '\n';
    var textarea = document.getElementById('speech-log');
    textarea.scrollTop = textarea.scrollHeight;
  });

  var speech = function() {
    event.preventDefault();
    var msg = speechEl.value;
    speechEl.value = '';
    var request = new XMLHttpRequest();
    request.open('POST', '/speech?room=' + room, true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(JSON.stringify({ message: msg, voice: selectEl.value }));
  };
}
else {
  //voice not supported in FF, so remove it!
  var voice = document.getElementById('voice');
  voice.parentNode.removeChild(voice);
}

socket.emit('joinroom', room);

socket.on('notification', function(msg){
  var notificationManager = document.getElementById('notification-manager');
  var toast = document.createElement('div');
  toast.className='toast';
  var toastMsg = document.createTextNode(msg);
  toast.appendChild(toastMsg);
  notificationManager.appendChild(toast);
  var promise = new Promise(function(resolve, reject){
    setTimeout(function(){
      toast.classList.toggle('toast--active');
      setTimeout(function(){
        toast.classList.toggle('toast--active');
        resolve();
      }, 1000);
    }, 1000);
  });
  promise.then(function(){
    //wait an additional 300ms to account for the css transition
    setTimeout(function(){
      notificationManager.removeChild(toast);
    }, 300);
  });
});

socket.on('load', function(soundList) {
  // Build sound dictionary (String -> { el: DOMElement, file: Audio, name: string })
  sounds = soundList.reduce(function(sounds, sound) {
    sounds[sound.name] = {};
    sounds[sound.name].el = document.querySelectorAll('[data-sound="' + sound.name  + '"]')[0];
    sounds[sound.name].name = sound.name;
    registerOnClick(sounds[sound.name]);
    return sounds;
  }, sounds);
});

socket.on('play', function(sound, directory) {
  if (!sounds[sound]) return console.error('Missing sound: ' + sound);

  if (muteEl.checked) return;

  if (!sounds[sound]['file']) sounds[sound]['file'] = new Audio('/sounds/' + directory + '/' + sound + '.mp3');

  sounds[sound].file.play();
  shake(sounds[sound].el);
});

socket.on('reconnect', function() {
  socket.emit('joinroom', room);
});

function registerOnClick(sound) {
  // Register click handler
  if (sound.el) {
    sound.el.addEventListener('click', function() {
      var request = new XMLHttpRequest();
      request.open('GET', '/sounds/' + sound.name + '?room=' + room, true);
      request.onerror = function() {
        alert('Could not reach server!');
      };
      request.send();
    });
  }
}

var roomLocation = document.getElementById('roomLocation');
roomLocation.innerText = window.location.href;
roomLocation.setAttribute('href', window.location.href);
