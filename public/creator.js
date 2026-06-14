// Default Quizzes data to pre-populate if localStorage is empty
const DEFAULT_QUIZZES = [
  {
    id: "default-trivia",
    title: "Quiz di Benvenuto (Trivia)",
    redirectUrl: "https://www.google.it",
    questions: [
      {
        text: "La Coca-Cola aiuta a digerire?",
        timer: 15,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 1, // NO
        options: ["Sì", "No"],
        visualization: "cola-glass"
      },
      {
        text: "Nello spazio si diventa più alti?",
        timer: 15,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 0, // Vero
        options: ["Vero", "Falso"],
        visualization: "stretching-silhouettes"
      },
      {
        text: "I pesci rossi hanno una memoria di pochi secondi?",
        timer: 15,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 1, // No
        options: ["Sì", "No"],
        visualization: "fish-bowl"
      },
      {
        text: "Quale di queste cose è più probabile che il nostro cervello faccia?",
        timer: 20,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 1, // Ricostruire il ricordo ogni volta
        options: [
          "Ricordare perfettamente un evento",
          "Ricostruire il ricordo ogni volta",
          "Registrare i fatti come una telecamera",
          "Non commettere errori"
        ],
        visualization: "bar-chart"
      },
      {
        text: "Nello spazio si può piangere normalmente?",
        timer: 15,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 1, // No
        options: ["Sì", "No"],
        visualization: "bar-chart"
      },
      {
        text: "Quale di queste affermazioni descrive meglio la scienza?",
        timer: 20,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 2, // Migliora continuamente le proprie domande
        options: [
          "Trova verità definitive",
          "Elimina il dubbio",
          "Migliora continuamente le proprie domande",
          "Dimostra sempre di avere ragione"
        ],
        visualization: "bar-chart"
      },
      {
        text: "Secondo voi, qual è la qualità più importante per vivere mesi nello spazio?",
        timer: 20,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 3, // Capacità di convivere con gli altri
        options: [
          "Coraggio",
          "Intelligenza",
          "Disciplina",
          "Capacità di convivere con gli altri"
        ],
        visualization: "bar-chart"
      },
      {
        text: "Quando Kennedy annunciò che l'America sarebbe andata sulla Luna entro la fine degli anni '60, quanti americani erano convinti che sarebbe successo davvero?",
        timer: 25,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 2, // Meno della metà
        options: [
          "Quasi tutti",
          "Più della metà",
          "Meno della metà",
          "Quasi nessuno"
        ],
        visualization: "astronaut-reveal"
      },
      {
        text: "Quale parola secondo voi rappresenta le quattro prospettive ascoltate oggi (Apollo, Spazio, Fisica, Longwave)?",
        timer: 25,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: -1, // No correct answer (Poll!)
        options: [
          "Coraggio",
          "Curiosità",
          "Fiducia",
          "Collaborazione"
        ],
        visualization: "word-cloud"
      }
    ]
  }
];

let quizzes = [];
let activeQuizIndex = 0;
let activeQuestionIndex = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load from localStorage or seed defaults
  const stored = localStorage.getItem('multitemer_quizzes_v2');
  if (stored) {
    quizzes = JSON.parse(stored);
  } else {
    quizzes = DEFAULT_QUIZZES;
    saveToStorage();
  }

  populateQuizSelect();
  loadSelectedQuiz();
});

function saveToStorage() {
  localStorage.setItem('multitemer_quizzes_v2', JSON.stringify(quizzes));
}

function populateQuizSelect() {
  const select = document.getElementById('quiz-select');
  select.innerHTML = '';
  quizzes.forEach((quiz, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = quiz.title;
    select.appendChild(opt);
  });
  select.value = activeQuizIndex;
}

function loadSelectedQuiz() {
  const select = document.getElementById('quiz-select');
  activeQuizIndex = parseInt(select.value) || 0;
  if (activeQuizIndex >= quizzes.length) activeQuizIndex = 0;
  
  if (quizzes.length === 0) {
    createNewQuiz();
    return;
  }

  const quiz = quizzes[activeQuizIndex];
  document.getElementById('quiz-redirect-url').value = quiz.redirectUrl || 'https://www.google.it';

  activeQuestionIndex = 0;
  renderQuestionsSidebar();
  loadQuestionIntoEditor();
}

function createNewQuiz() {
  const title = prompt("Inserisci il titolo del nuovo quiz:", "Nuovo Quiz Convention");
  if (!title) return;

  const newQuiz = {
    id: 'quiz-' + Date.now(),
    title: title,
    redirectUrl: 'https://www.google.it',
    questions: [
      {
        text: "Esempio prima domanda?",
        timer: 20,
        mediaType: "none",
        mediaUrl: "",
        correctAnswer: 0,
        options: ["Opzione A", "Opzione B", "Opzione C", "Opzione D"]
      }
    ]
  };

  quizzes.push(newQuiz);
  saveToStorage();
  activeQuizIndex = quizzes.length - 1;
  populateQuizSelect();
  loadSelectedQuiz();
}

function deleteActiveQuiz() {
  if (quizzes.length <= 1) {
    alert("Devi avere almeno un quiz salvato.");
    return;
  }
  
  if (!confirm(`Sei sicuro di voler eliminare il quiz "${quizzes[activeQuizIndex].title}"?`)) {
    return;
  }

  quizzes.splice(activeQuizIndex, 1);
  saveToStorage();
  activeQuizIndex = 0;
  populateQuizSelect();
  loadSelectedQuiz();
}

function renderQuestionsSidebar() {
  const container = document.getElementById('questions-list-container');
  container.innerHTML = '';
  
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;

  quiz.questions.forEach((q, idx) => {
    const tab = document.createElement('div');
    tab.className = `q-item-tab ${idx === activeQuestionIndex ? 'active' : ''}`;
    tab.onclick = (e) => {
      // Check if clicking the delete button
      if (e.target.classList.contains('q-delete-btn')) return;
      selectQuestion(idx);
    };

    // Label snippet
    const snippet = q.text.length > 22 ? q.text.substring(0, 20) + '...' : q.text;
    tab.innerHTML = `
      <span>D${idx + 1}: ${snippet}</span>
      <button class="q-delete-btn" onclick="deleteQuestion(${idx})">&times;</button>
    `;
    container.appendChild(tab);
  });
}

function selectQuestion(idx) {
  activeQuestionIndex = idx;
  renderQuestionsSidebar();
  loadQuestionIntoEditor();
}

function loadQuestionIntoEditor() {
  const quiz = quizzes[activeQuizIndex];
  const q = quiz.questions[activeQuestionIndex];
  if (!q) return;

  document.getElementById('editor-title').textContent = `Modifica Domanda ${activeQuestionIndex + 1}`;
  document.getElementById('q-text').value = q.text;
  document.getElementById('q-timer').value = q.timer;
  document.getElementById('q-media-type').value = q.mediaType || 'none';
  document.getElementById('q-media-url').value = q.mediaUrl || '';
  
  // Set options text
  document.getElementById('opt-a-text').value = q.options[0] || '';
  document.getElementById('opt-b-text').value = q.options[1] || '';
  document.getElementById('opt-c-text').value = q.options[2] || '';
  document.getElementById('opt-d-text').value = q.options[3] || '';

  // Correct answer radio
  const radios = document.getElementsByName('correct-opt');
  if (radios[q.correctAnswer]) {
    radios[q.correctAnswer].checked = true;
  }

  toggleMediaInput();
}

function toggleMediaInput() {
  const type = document.getElementById('q-media-type').value;
  const group = document.getElementById('media-url-group');
  if (type === 'none') {
    group.style.display = 'none';
  } else {
    group.style.display = 'block';
  }
}

function saveActiveQuestion(e) {
  if (e) e.preventDefault();

  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;

  const text = document.getElementById('q-text').value;
  const timer = parseInt(document.getElementById('q-timer').value) || 20;
  const mediaType = document.getElementById('q-media-type').value;
  const mediaUrl = document.getElementById('q-media-url').value;

  // Re-build options array (filter out empty inputs if you want, but we enforce 2 to 4 options)
  const options = [];
  const optA = document.getElementById('opt-a-text').value.trim();
  const optB = document.getElementById('opt-b-text').value.trim();
  const optC = document.getElementById('opt-c-text').value.trim();
  const optD = document.getElementById('opt-d-text').value.trim();

  if (!optA || !optB) {
    alert("Devi compilare almeno le prime due risposte (A e B).");
    return;
  }

  options.push(optA);
  options.push(optB);
  if (optC) options.push(optC);
  if (optD) options.push(optD);

  // Correct Answer Index
  let correctAnswer = 0;
  const radios = document.getElementsByName('correct-opt');
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      correctAnswer = i;
      break;
    }
  }

  // Check if correct answer option is configured (e.g. checked C but C is empty)
  if (correctAnswer >= options.length) {
    alert(`Hai spuntato l'opzione corretta ${String.fromCharCode(65 + correctAnswer)}, ma il relativo testo è vuoto!`);
    return;
  }

  const existingQ = quiz.questions[activeQuestionIndex];
  // Update object
  quiz.questions[activeQuestionIndex] = {
    ...existingQ,
    text,
    timer,
    mediaType,
    mediaUrl,
    correctAnswer,
    options
  };

  saveToStorage();
  renderQuestionsSidebar();
  alert("Domanda salvata con successo!");
}

function addNewQuestion() {
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;

  const newQ = {
    text: "Nuova Domanda?",
    timer: 20,
    mediaType: "none",
    mediaUrl: "",
    correctAnswer: 0,
    options: ["Opzione A", "Opzione B", "Opzione C", "Opzione D"]
  };

  quiz.questions.push(newQ);
  saveToStorage();
  activeQuestionIndex = quiz.questions.length - 1;
  renderQuestionsSidebar();
  loadQuestionIntoEditor();
  
  // Smooth scroll to editor
  document.getElementById('question-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteQuestion(idx) {
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;

  if (quiz.questions.length <= 1) {
    alert("Un quiz deve contenere almeno una domanda.");
    return;
  }

  if (!confirm(`Vuoi eliminare la domanda ${idx + 1}?`)) {
    return;
  }

  quiz.questions.splice(idx, 1);
  saveToStorage();
  
  if (activeQuestionIndex >= quiz.questions.length) {
    activeQuestionIndex = quiz.questions.length - 1;
  }
  
  renderQuestionsSidebar();
  loadQuestionIntoEditor();
}

function exportJSON() {
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${quiz.title.replace(/\s+/g, '_')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function startHostWithThisQuiz() {
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;
  // Redirect to presenter with active index
  window.location.href = `presenter.html?quizId=${activeQuizIndex}`;
}

function saveQuizSettings() {
  const quiz = quizzes[activeQuizIndex];
  if (!quiz) return;
  const url = document.getElementById('quiz-redirect-url').value.trim();
  quiz.redirectUrl = url || 'https://www.google.it';
  saveToStorage();
  alert("Link di reindirizzamento salvato con successo!");
}
