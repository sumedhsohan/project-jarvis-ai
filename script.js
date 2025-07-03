const userName = "Sumedh";
const mistralApiKey = "NNUpo8KWN20nLltxTk3XaH84BPW6vMhu";
let alarmTimers = [];
let recognition; // Global recognition instance

function getCurrentDateTime() {
  const now = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  return {
    date: now.toLocaleDateString('en-US', dateOptions),
    time: now.toLocaleTimeString('en-US', timeOptions)
  };
}

function speak(text) {
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira")) || voices[0];
  utterance.rate = 1;
  utterance.pitch = 1.1;
  speechSynthesis.speak(utterance);
}

function humanLikeResponse(text) {
  const thinkingPhrases = ["Let me think...", "Alright, give me a second...", "Hmm, checking that for you..."];
  const delay = 1000 + Math.random() * 1000;
  const preText = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
  addMessage(preText, "ai");
  speak(preText);
  setTimeout(() => {
    addMessage(text, "ai");
  }, delay);
}

function greetUser() {
  const { date, time } = getCurrentDateTime();
  const greeting = `Hey ${userName}, it's ${date}, around ${time}. I'm all ears — what do you want to know today?`;
  addMessage(greeting, "ai");
  speak(greeting);
  document.getElementById("speakBtn").style.display = "none"; // Hide speak button
}

// 🎤 Continuous background voice recognition
function startContinuousRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error("Speech Recognition not supported in this browser.");
    return;
  }

  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  const orb = document.getElementById("floatingOrb");
  if (orb) orb.classList.add("listening");

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    if (transcript.length > 0) {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      processCommand(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    if (event.error !== "not-allowed") {
      recognition.stop();
      setTimeout(startContinuousRecognition, 1000);
    }
  };

  recognition.onend = () => {
    setTimeout(startContinuousRecognition, 500);
  };

  recognition.start();
}

async function askMistral(question) {
  const url = "https://api.mistral.ai/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mistralApiKey}`
    },
    body: JSON.stringify({
      model: "mistral-small",
      messages: [
        { role: "system", content: "You are Jarvis, a friendly and helpful assistant that sounds like a human friend." },
        { role: "user", content: question }
      ]
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function addMessage(text, type) {
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  msg.innerText = text;
  document.getElementById('output').appendChild(msg);
  msg.scrollIntoView({ behavior: "smooth" });
  if (type === "ai") speak(text);
}

function saveMemory(note) {
  const memories = JSON.parse(localStorage.getItem("jarvisMemory")) || [];
  memories.push({ note, time: new Date().toLocaleString() });
  localStorage.setItem("jarvisMemory", JSON.stringify(memories));
  humanLikeResponse("Got it. I've saved that for you.");
}

function recallMemories() {
  const memories = JSON.parse(localStorage.getItem("jarvisMemory")) || [];
  if (memories.length === 0) {
    humanLikeResponse("You haven't asked me to remember anything yet.");
  } else {
    let reply = "Here's what you've asked me to remember:\n";
    memories.forEach((m, i) => {
      reply += `${i + 1}. "${m.note}" (saved on ${m.time})\n`;
    });
    humanLikeResponse(reply.trim());
  }
}

function clearMemories() {
  localStorage.removeItem("jarvisMemory");
  humanLikeResponse("Memory wiped clean. Nothing saved now.");
}

function setAlarmTime(hour, minute, label) {
  const now = new Date();
  const alarmTime = new Date();
  alarmTime.setHours(hour);
  alarmTime.setMinutes(minute);
  alarmTime.setSeconds(0);
  if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);

  const timeDiff = alarmTime.getTime() - now.getTime();
  const timeout = setTimeout(() => {
    speak(`⏰ Reminder: ${label || "Alarm time!"}`);
    addMessage(`🔔 Reminder triggered: ${label || "Alarm"}`, "ai");
  }, timeDiff);

  alarmTimers.push({ timeout, label, time: alarmTime.toLocaleTimeString() });
  humanLikeResponse(`Alarm set for ${alarmTime.toLocaleTimeString()}${label ? `: "${label}"` : ""}`);
}

function setCountdownReminder(minutes, label) {
  const ms = minutes * 60000;
  const timeout = setTimeout(() => {
    speak(`⏰ Reminder: ${label || `${minutes} minute timer is up!`}`);
    addMessage(`🔔 Reminder: ${label || `${minutes} minute timer is up!`}`, "ai");
  }, ms);

  const time = new Date(Date.now() + ms).toLocaleTimeString();
  alarmTimers.push({ timeout, label, time });
  humanLikeResponse(`I'll remind you in ${minutes} minutes${label ? `: "${label}"` : ""}`);
}

function listAlarms() {
  if (alarmTimers.length === 0) {
    humanLikeResponse("No alarms or reminders are currently set.");
  } else {
    let msg = "Here are your upcoming alarms:\n";
    alarmTimers.forEach((a, i) => {
      msg += `${i + 1}. ${a.label || "Alarm"} at ${a.time}\n`;
    });
    humanLikeResponse(msg.trim());
  }
}

function clearAlarms() {
  alarmTimers.forEach(a => clearTimeout(a.timeout));
  alarmTimers = [];
  humanLikeResponse("All alarms and reminders have been cleared.");
}

function processCommand(command) {
  const trimmed = command.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return;

  addMessage(trimmed, "user");
  const { date, time } = getCurrentDateTime();

  if (trimmed.startsWith("remember") || trimmed.startsWith("note") || trimmed.startsWith("remind me to")) {
    const note = trimmed.replace(/^(remember|note|remind me to)/, "").trim();
    if (note.length > 2) saveMemory(note);
    else humanLikeResponse("What exactly should I remember?");
    return;
  }

  if (trimmed.includes("show my notes") || trimmed.includes("what did i ask") || trimmed.includes("recall memory")) {
    recallMemories(); return;
  }

  if (trimmed.includes("clear memory") || trimmed.includes("forget everything")) {
    clearMemories(); return;
  }

  if (trimmed.match(/set alarm for (\d{1,2})([:.](\d{1,2}))?\s?(am|pm)?/)) {
    const match = trimmed.match(/set alarm for (\d{1,2})([:.](\d{1,2}))?\s?(am|pm)?/);
    let hour = parseInt(match[1]);
    let minute = match[3] ? parseInt(match[3]) : 0;
    const ampm = match[4];
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    setAlarmTime(hour, minute);
    return;
  }

  if (trimmed.match(/remind me in (\d+) (minute|minutes)/)) {
    const match = trimmed.match(/remind me in (\d+) (minute|minutes)/);
    const mins = parseInt(match[1]);
    const label = trimmed.split("to").slice(1).join(" ").trim();
    setCountdownReminder(mins, label);
    return;
  }

  if (trimmed.includes("what alarms") || trimmed.includes("list alarms") || trimmed.includes("show reminders")) {
    listAlarms(); return;
  }

  if (trimmed.includes("cancel alarms") || trimmed.includes("clear alarms") || trimmed.includes("remove reminders")) {
    clearAlarms(); return;
  }

  if (trimmed.includes("open notepad")) {
    humanLikeResponse("Opening online notepad for you.");
    window.open("https://docs.google.com/document", "_blank");
  } else if (trimmed.includes("open calculator")) {
    humanLikeResponse("Launching calculator...");
    window.open("https://www.google.com/search?q=calculator", "_blank");
  } else if (trimmed.includes("open file explorer")) {
    humanLikeResponse("Trying to open your downloads folder.");
    window.open("file:///C:/Users/YourUsername/Downloads");
  } else if (trimmed.includes("open music")) {
    humanLikeResponse("Opening YouTube Music.");
    window.open("https://music.youtube.com/", "_blank");
  } else if (trimmed.includes("your name")) {
    humanLikeResponse("I'm Jarvis — your virtual buddy, always here to help.");
  } else if (trimmed.includes("my name")) {
    humanLikeResponse(`You're ${userName}, right? I’ve got a good memory!`);
  } else if (trimmed.includes("time") || trimmed.includes("date")) {
    humanLikeResponse(`It's currently ${time} on ${date}. Pretty nice day, huh?`);
  } else if (trimmed.startsWith("open google")) {
    humanLikeResponse("Sure thing! Opening Google for you now.");
    window.open("https://www.google.com", "_blank");
  } else if (trimmed.startsWith("search in google")) {
    const query = trimmed.replace("search in google", "").trim();
    if (query.length > 2) {
      humanLikeResponse(`Let's check Google for: "${query}"`);
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
    }
  } else if (trimmed.startsWith("open chatgpt")) {
    humanLikeResponse("Sure thing! Opening chatgpt for you now.");
    window.open("https://chatgpt.com/", "_blank");
  } else if (trimmed.startsWith("search in chatgpt")) {
    const query = trimmed.replace("search in chatgpt", "").trim();
    if (query.length > 2) {
      humanLikeResponse(`Let's check chatgpt for: "${query}"`);
      window.open(`https://chat.openai.com/?q=${encodeURIComponent(query)}`, "_blank");
    }
  } else if (trimmed.startsWith("open instagram")) {
    humanLikeResponse("Opening Instagram.");
    window.open("https://www.instagram.com", "_blank");
  } else if (trimmed.startsWith("search in instagram")) {
    const query = trimmed.replace("search in instagram", "").trim().replace(/\s+/g, '');
    if (query.length > 1) {
      humanLikeResponse(`Searching Instagram for hashtag "${query}"`);
      window.open(`https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`, "_blank");
    } else {
      humanLikeResponse("What hashtag should I search on Instagram?");
    }
  } else if (trimmed.startsWith("open youtube")) {
    humanLikeResponse("You got it! Heading to YouTube.");
    window.open("https://www.youtube.com", "_blank");
  } else if (trimmed.startsWith("search in youtube")) {
    const query = trimmed.replace("search in youtube", "").trim();
    if (query.length > 2) {
      humanLikeResponse(`Alright, finding "${query}" on YouTube.`);
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, "_blank");
    }
  } else {
    askMistral(trimmed).then(answer => {
      if (answer && answer.length > 5) {
        humanLikeResponse(answer);
      }
    });
  }
}

function analyzeImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const imageDataUrl = reader.result;
    const img = new Image();
    img.src = imageDataUrl;
    img.style.maxWidth = "200px";
    img.style.margin = "10px";
    document.getElementById("output").appendChild(img);
    Tesseract.recognize(imageDataUrl, 'eng')
      .then(({ data: { text } }) => {
        if (text.trim()) {
          humanLikeResponse(`Looks like the image says:\n"${text.trim()}"`);
        } else {
          humanLikeResponse("Hmm... I couldn’t find readable text in that image.");
        }
      })
      .catch(err => {
        console.error(err);
        humanLikeResponse("Oops! Something went wrong while analyzing that image.");
      });
  };
  reader.readAsDataURL(file);
}

window.onload = () => {
  setTimeout(() => {
    speechSynthesis.onvoiceschanged = () => {
      greetUser();
      startContinuousRecognition(); // 👂 Starts voice recognition immediately
    };

    document.getElementById("sendBtn").addEventListener("click", () => {
      const text = document.getElementById("textInput").value.trim();
      if (text) {
        processCommand(text);
        document.getElementById("textInput").value = "";
      }
    });

    document.getElementById("textInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") document.getElementById("sendBtn").click();
    });

    document.getElementById("fileInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      addMessage(`Let's check what's inside this file: ${file.name}`, "user");
      if (file.type.startsWith("image/")) {
        analyzeImage(file);
      } else {
        humanLikeResponse("Hmm... I can only analyze images for now. PDFs and text files are coming soon!");
      }
    });

    const orb = document.getElementById("floatingOrb");
    if (orb) {
      orb.addEventListener("click", () => {
        speak("I'm always listening...");
      });
    }
  }, 1000);
};
