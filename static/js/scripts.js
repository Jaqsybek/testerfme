// Global variables
let currentQuestions = [];
let currentTestName = '';
let currentQuestionIndex = 0;
let userAnswers = [];
let incorrectQuestions = [];

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  init();
  
  // Event listeners for retry and choose new test buttons
  document.getElementById('retry-btn').addEventListener('click', function() {
    resetTest();
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
  });
  
  document.getElementById('new-test-btn').addEventListener('click', function() {
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
    document.getElementById('test-container').innerHTML = '';
    document.getElementById('test-info').classList.add('d-none');
    document.getElementById('test-selector').value = '';
  });
  
  // Listen for keyboard number press (1-5) to select answers
  document.addEventListener('keydown', function(e) {
    if (currentQuestions.length > 0 && !document.getElementById('results-container').classList.contains('d-none')) {
      return; // Ignore key presses when showing results
    }
    
    // Track the last pressed key and time
    const now = new Date().getTime();
    
    // Number keys 1-5
    if (e.key >= '1' && e.key <= '5') {
      const optionIndex = parseInt(e.key) - 1;
      const currentOptions = document.querySelectorAll('.current-question .form-check-input');
      
      if (currentOptions.length > optionIndex) {
        const selectedInput = currentOptions[optionIndex];
        
        // If the input is already disabled (answer already shown)
        if (selectedInput.disabled) {
          // If pressing the same key as before, go to next question
          if (userAnswers[currentQuestionIndex] === selectedInput.value) {
            goToNextQuestion();
          }
          return;
        }
        
        // Select the option
        selectedInput.checked = true;
        userAnswers[currentQuestionIndex] = selectedInput.value;
        
        // Show the correct answer immediately
        highlightCorrectAnswer();
      }
    }
    
    // Right arrow key to go to next question after selecting an answer
    if (e.key === 'ArrowRight') {
      const checkedOption = document.querySelector('.current-question .form-check-input:checked');
      if (checkedOption) {
        goToNextQuestion();
      }
    }
    
    // Enter key to confirm the selected answer
    if (e.key === 'Enter') {
      const checkedOption = document.querySelector('.current-question .form-check-input:checked');
      if (checkedOption && !checkedOption.disabled) {
        // Only highlight if not already highlighted
        highlightCorrectAnswer();
      }
    }
  });
});

// Initialize the application
async function init() {
  const selector = document.getElementById('test-selector');
  
  try {
    // Show loading indicator
    selector.innerHTML = '<option value="">Loading tests...</option>';
    
    // Fetch test list
    const testList = await fetchTestList();
    
    // Clear loading message
    selector.innerHTML = '<option value="">-- Choose a medical test --</option>';
    
    // Add options for each test
    testList.forEach(filename => {
      const option = document.createElement('option');
      option.value = filename;
      
      // Format the display name (remove .txt and capitalize)
      const displayName = filename.replace('.txt', '')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
        
      option.textContent = displayName;
      selector.appendChild(option);
    });
    
    // Handle test selection
    selector.onchange = async () => {
      if (!selector.value) return;
      
      currentTestName = selector.options[selector.selectedIndex].textContent;
      
      // Show loading message
      document.getElementById('test-container').innerHTML = `
        <div class="text-center py-5">
          <span class="loader"></span>
          <p class="mt-3">Loading test content...</p>
        </div>
      `;
      
      try {
        // Fetch and parse test file
        const content = await fetchTestFile(selector.value);
        currentQuestions = parseTest(content);
        
        // Update question count info
        document.getElementById('question-count').textContent = currentQuestions.length;
        
        // Если имя файла содержит число (например "Неврология 196.txt"), но количество вопросов не совпадает
        const filenameMatch = selector.value.match(/(\d+)\.txt$/);
        if (filenameMatch && parseInt(filenameMatch[1]) !== currentQuestions.length) {
          console.warn(`Внимание: В названии файла указано ${filenameMatch[1]} вопросов, но найдено только ${currentQuestions.length}`);
        }
        
        document.getElementById('test-info').classList.remove('d-none');
        
        // Display test questions
        displayTest(currentQuestions);
      } catch (error) {
        document.getElementById('test-container').innerHTML = `
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Error loading test: ${error.message}
          </div>
        `;
      }
    };
  } catch (error) {
    selector.innerHTML = '<option value="">Error loading tests</option>';
    console.error('Failed to initialize:', error);
  }
}

// Fetch list of available tests
async function fetchTestList() {
  const response = await fetch('/tests');
  if (!response.ok) {
    throw new Error('Failed to fetch test list');
  }
  return await response.json();
}

// Fetch test file content
async function fetchTestFile(filename) {
  const response = await fetch(`/tests/${filename}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test content');
  }
  return await response.text();
}

// Parse test content
function parseTest(content) {
  const lines = content.split('\n');
  const questions = [];
  let currentQuestion = null;
  const MAX_VARIANTS = 5; // Ограничиваем количество вариантов ответа до 5

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Проверяем различные варианты форматирования тега question:
    // 1. Стандартный тег: <question>текст
    // 2. Тег с пробелом: <question >текст
    // 3. Нумерация перед тегом: 1. <question>текст или 1.<question>текст
    if (
      trimmedLine.startsWith('<question>') || 
      trimmedLine.startsWith('<question ') || 
      trimmedLine.match(/^<question\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question\s*>/)
    ) {
      if (currentQuestion) {
        // Если у вопроса больше 5 вариантов, оставляем только первые 5
        if (currentQuestion.variants.length > MAX_VARIANTS) {
          console.warn(`Вопрос "${currentQuestion.q}" имеет ${currentQuestion.variants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
          currentQuestion.variants = currentQuestion.variants.slice(0, MAX_VARIANTS);
        }
        questions.push(currentQuestion);
      }
      // Извлекаем текст вопроса, обрабатывая разные варианты форматирования тега
      let questionText = trimmedLine;
      
      // Удаляем номер вопроса, если он есть (например, "1." или "1.1.")
      if (questionText.match(/^\d+(\.\d+)*\s*\./)) {
        questionText = questionText.replace(/^\d+(\.\d+)*\s*\./, '').trim();
      }
      
      // Удаляем тег вопроса с учетом различных форматов
      if (questionText.startsWith('<question>')) {
        questionText = questionText.replace('<question>', '');
      } else if (questionText.match(/^<question\s*>/)) {
        questionText = questionText.replace(/^<question\s*>/, '');
      }
      
      currentQuestion = { 
        q: questionText.trim(), 
        variants: [], 
        answer: null 
      };
    // Проверяем различные варианты форматирования тега variant:
    // 1. Стандартный тег: <variant>текст
    // 2. Тег с пробелом: <variant >текст
    // 3. Нумерация перед тегом: 1. <variant>текст или 1.<variant>текст
    } else if (
      trimmedLine.startsWith('<variant>') || 
      trimmedLine.startsWith('<variant ') || 
      trimmedLine.match(/^<variant\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant\s*>/)
    ) {
      // Извлекаем текст варианта ответа, обрабатывая разные форматы тега
      let text = trimmedLine;
      
      // Удаляем номер варианта, если он есть (например, "1." или "1.1.")
      if (text.match(/^\d+(\.\d+)*\s*\./)) {
        text = text.replace(/^\d+(\.\d+)*\s*\./, '').trim();
      }
      
      // Удаляем тег варианта с учетом различных форматов
      if (text.startsWith('<variant>')) {
        text = text.replace('<variant>', '');
      } else if (text.match(/^<variant\s*>/)) {
        text = text.replace(/^<variant\s*>/, '');
      } else if (text.match(/^\d+\s*\.\s*<variant>/)) {
        text = text.replace(/^\d+\s*\.\s*<variant>/, '');
      } else if (text.match(/^\d+\s*\.\s*<variant\s*>/)) {
        text = text.replace(/^\d+\s*\.\s*<variant\s*>/, '');
      }
      text = text.trim();
      if (currentQuestion) {
        if (currentQuestion.answer === null) currentQuestion.answer = text;
        // Добавляем вариант только если не превышен лимит MAX_VARIANTS
        if (currentQuestion.variants.length < MAX_VARIANTS) {
          currentQuestion.variants.push(text);
        }
      }
    }
  }
  
  if (currentQuestion) {
    // Проверяем последний вопрос на превышение лимита вариантов
    if (currentQuestion.variants.length > MAX_VARIANTS) {
      console.warn(`Вопрос "${currentQuestion.q}" имеет ${currentQuestion.variants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
      currentQuestion.variants = currentQuestion.variants.slice(0, MAX_VARIANTS);
    }
    questions.push(currentQuestion);
  }
  return questions;
}

// Shuffle array (Fisher-Yates algorithm)
function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Reset test state
function resetTest() {
  currentQuestionIndex = 0;
  userAnswers = [];
  incorrectQuestions = [];
  displayCurrentQuestion();
}

// Display test questions - new version showing one question at a time
function displayTest(questions) {
  // Reset state
  currentQuestionIndex = 0;
  userAnswers = new Array(questions.length).fill(null);
  incorrectQuestions = [];
  
  // Display first question
  displayCurrentQuestion();
}

// Display the current question only
function displayCurrentQuestion() {
  const container = document.getElementById('test-container');
  container.innerHTML = '';
  
  // Create a title for the test
  const testTitle = document.createElement('h2');
  testTitle.className = 'h4 mb-4';
  testTitle.innerHTML = `<i class="fas fa-heartbeat text-danger me-2"></i> ${currentTestName}`;
  container.appendChild(testTitle);
  
  // Create progress info
  const progressInfo = document.createElement('div');
  progressInfo.className = 'test-progress mb-3';
  progressInfo.innerHTML = `
    <span class="badge bg-secondary">
      Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}
    </span>
  `;
  container.appendChild(progressInfo);
  
  // Create the current question card
  const q = currentQuestions[currentQuestionIndex];
  const card = document.createElement('div');
  card.className = 'card question-card mb-4 current-question';
  
  // Card content
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';
  
  // Question text
  const questionText = document.createElement('h3');
  questionText.className = 'h5 mb-3';
  questionText.textContent = q.q;
  cardBody.appendChild(questionText);
  
  // Answer options
  // Shuffle only on first display of this question
  let variants = q.shuffledVariants;
  if (!variants) {
    variants = shuffle([...q.variants]);
    q.shuffledVariants = variants;
  }
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'options-container';
  
  variants.forEach((variant, varIndex) => {
    const optionId = `q${currentQuestionIndex}_${varIndex}`;
    
    const formCheck = document.createElement('div');
    formCheck.className = 'form-check';
    
    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'radio';
    input.name = `q${currentQuestionIndex}`;
    input.id = optionId;
    input.value = variant;
    
    // If this question has a saved answer, select it
    if (userAnswers[currentQuestionIndex] === variant) {
      input.checked = true;
    }
    
    // Add number prefix to help with keyboard selection
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = optionId;
    label.innerHTML = `<strong>${varIndex + 1}.</strong> ${variant}`;
    
    // Add click event listener to only show correct answer (without automatic navigation)
    input.addEventListener('change', function() {
      userAnswers[currentQuestionIndex] = this.value;
      
      // Highlight the correct answer immediately
      highlightCorrectAnswer();
    });
    
    formCheck.appendChild(input);
    formCheck.appendChild(label);
    optionsContainer.appendChild(formCheck);
  });
  
  cardBody.appendChild(optionsContainer);
  card.appendChild(cardBody);
  container.appendChild(card);
  
  // Navigation buttons - make them sticky for mobile
  const navContainer = document.createElement('div');
  navContainer.className = 'd-flex justify-content-between my-3 navigation-buttons';
  
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-outline-secondary';
  prevBtn.innerHTML = '<i class="fas fa-arrow-left me-2"></i>Предыдущий вопрос';
  prevBtn.disabled = currentQuestionIndex === 0;
  prevBtn.onclick = goToPreviousQuestion;
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-outline-primary';
  nextBtn.innerHTML = 'Следующий вопрос<i class="fas fa-arrow-right ms-2"></i>';
  nextBtn.disabled = currentQuestionIndex === currentQuestions.length - 1;
  nextBtn.onclick = goToNextQuestion;
  
  // Add to container
  navContainer.appendChild(prevBtn);
  navContainer.appendChild(nextBtn);
  container.appendChild(navContainer);
  
  // Finish button (only on last question or when all questions have answers)
  if (currentQuestionIndex === currentQuestions.length - 1 || userAnswers.every(a => a !== null)) {
    const finishContainer = document.createElement('div');
    finishContainer.className = 'd-grid gap-2 mx-auto my-4';
    
    const finishBtn = document.createElement('button');
    finishBtn.className = 'btn btn-success btn-lg';
    finishBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Завершить тест его величества Жаксыбека';
    finishBtn.onclick = finishTest;
    
    finishContainer.appendChild(finishBtn);
    container.appendChild(finishContainer);
  }
  
  // Add keyboard navigation hint
  const keyboardHint = document.createElement('div');
  keyboardHint.className = 'alert alert-info mt-3 keyboard-hint';
  keyboardHint.innerHTML = `
    <h6><i class="fas fa-keyboard me-2"></i>Подсказка:</h6>
    <p class="mb-0">
      <b>1-5</b> - выбрать вариант ответа и показать правильный ответ<br>
      <b>1-5</b> (повторно) - перейти к следующему вопросу<br>
      <b>Enter</b> - подтвердить ответ и увидеть правильный вариант<br>
      <b>→</b> (стрелка вправо) - перейти к следующему вопросу
    </p>
  `;
  container.appendChild(keyboardHint);
}

// Navigate to the next question
function goToNextQuestion() {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    displayCurrentQuestion();
  }
}

// Navigate to the previous question
function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayCurrentQuestion();
  }
}

// Highlight the correct answer for the current question
function highlightCorrectAnswer() {
  const currentQuestion = currentQuestions[currentQuestionIndex];
  const correctAnswer = currentQuestion.answer;
  const options = document.querySelectorAll('.current-question .form-check');
  
  // Disable all inputs
  const inputs = document.querySelectorAll('.current-question .form-check-input');
  inputs.forEach(input => {
    input.disabled = true;
  });
  
  // Find the selected answer
  const selectedAnswer = userAnswers[currentQuestionIndex];
  const isCorrect = selectedAnswer === correctAnswer;
  
  // Highlight correct and incorrect options
  options.forEach(option => {
    const input = option.querySelector('input');
    const label = option.querySelector('label');
    
    if (input.value === correctAnswer) {
      // Correct answer
      option.classList.add('option-correct');
      if (!label.innerHTML.includes('fa-check')) {
        label.innerHTML += ' <i class="fas fa-check text-success"></i>';
      }
    } else if (input.checked) {
      // Incorrect selected answer
      if (!isCorrect) {
        option.classList.add('option-incorrect');
        if (!label.innerHTML.includes('fa-times')) {
          label.innerHTML += ' <i class="fas fa-times text-danger"></i>';
        }
      }
    }
  });
  
  // Add appropriate class to the question card
  const questionCard = document.querySelector('.current-question');
  if (isCorrect) {
    questionCard.classList.add('correct-answer');
  } else {
    questionCard.classList.add('incorrect-answer');
  }
}

// Finish the test and show results
function finishTest() {
  // Calculate results
  let score = 0;
  let totalAnswered = 0;
  incorrectQuestions = [];
  
  // Check each question
  currentQuestions.forEach((q, i) => {
    const userAnswer = userAnswers[i];
    
    if (userAnswer) {
      totalAnswered++;
      const isCorrect = userAnswer === q.answer;
      
      if (isCorrect) {
        score++;
      } else {
        // Add to incorrect questions list
        incorrectQuestions.push({
          question: q.q,
          userAnswer: userAnswer,
          correctAnswer: q.answer
        });
      }
    }
  });
  
  // Show results
  const resultsContainer = document.getElementById('results-container');
  const scoreFraction = document.getElementById('score-fraction');
  const scorePercentage = document.getElementById('score-percentage');
  const scoreProgress = document.getElementById('score-progress');
  
  // Calculate percentage
  const percentage = totalAnswered > 0 ? Math.round((score / currentQuestions.length) * 100) : 0;
  
  // Update result display
  scoreFraction.textContent = `${score} / ${currentQuestions.length}`;
  scorePercentage.textContent = `${percentage}%`;
  scoreProgress.style.width = `${percentage}%`;
  
  // Set progress bar color based on score
  if (percentage >= 80) {
    scoreProgress.className = 'progress-bar bg-success';
  } else if (percentage >= 60) {
    scoreProgress.className = 'progress-bar bg-warning';
  } else {
    scoreProgress.className = 'progress-bar bg-danger';
  }
  
  // Display incorrect answers if any
  displayIncorrectAnswers();
  
  // Show results
  resultsContainer.classList.remove('d-none');
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Display incorrect answers
function displayIncorrectAnswers() {
  const container = document.getElementById('incorrect-answers-container');
  
  // Clear previous content
  container.innerHTML = '';
  
  // If no incorrect answers, hide container
  if (incorrectQuestions.length === 0) {
    container.classList.add('d-none');
    return;
  }
  
  // Create header
  const header = document.createElement('h3');
  header.className = 'h5 mb-3';
  header.innerHTML = '<i class="fas fa-exclamation-triangle text-warning me-2"></i>Самые сложные вопросы для вас:';
  container.appendChild(header);
  
  // Create list of incorrect answers
  const list = document.createElement('div');
  list.className = 'list-group mb-4';
  
  incorrectQuestions.forEach((item, index) => {
    const listItem = document.createElement('div');
    listItem.className = 'list-group-item';
    
    listItem.innerHTML = `
      <div class="d-flex w-100 justify-content-between">
        <h5 class="mb-1">Вопрос ${index + 1}</h5>
      </div>
      <p class="mb-1">${item.question}</p>
      <div class="d-flex flex-column mt-2">
        <small class="text-danger">
          <i class="fas fa-times me-2"></i>
          Ваш ответ: ${item.userAnswer}
        </small>
        <small class="text-success">
          <i class="fas fa-check me-2"></i>
          Правильный ответ: ${item.correctAnswer}
        </small>
      </div>
    `;
    
    list.appendChild(listItem);
  });
  
  container.appendChild(list);
  container.classList.remove('d-none');
}

// Legacy function - kept for compatibility
function checkAnswers(questions) {
  finishTest();
}
