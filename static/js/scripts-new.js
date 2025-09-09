// Global variables
let currentQuestions = [];
let currentTestName = '';
let currentQuestionIndex = 0;
let userAnswers = [];
let incorrectQuestions = [];
let currentCategory = null;
let allTestsMode = false;
let allCategoryTests = [];
let currentTestIndex = 0;

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Document ready, initializing application');
  init();
  
  document.getElementById('retry-btn').addEventListener('click', function() {
    resetTest();
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
  });
  
  document.getElementById('new-test-btn').addEventListener('click', function() {
    allCategoryTests = [];
    currentTestIndex = 0;
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
    document.getElementById('test-container').innerHTML = '';
    document.getElementById('test-info').classList.add('d-none');
    document.getElementById('test-selector').value = '';
  });
});

// Global keyboard handler
window.onkeydown = function(e) {
  const tag = document.activeElement.tagName.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    console.log('Focus is on input/select, ignoring key press:', e.key);
    return;
  }
  console.log('Global key pressed:', e.key);
  if (currentQuestions.length === 0) {
    console.log('Ignoring key press: no questions loaded');
    return;
  }
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) {
    console.log('Ignoring key press: results container not found');
    return;
  }
  if (!resultsContainer.classList.contains('d-none')) {
    console.log('Ignoring key press: results are shown');
    return;
  }
  const currentQuestion = document.querySelector('.current-question');
  if (!currentQuestion) {
    console.log('Ignoring key press: no current question found');
    return;
  }
  if (e.key >= '1' && e.key <= '5') {
    console.log('Number key pressed:', e.key);
    const optionIndex = parseInt(e.key) - 1;
    const currentOptions = document.querySelectorAll('.current-question .form-check-input');
    console.log('Options found:', currentOptions.length, 'Looking for index:', optionIndex);
    if (currentOptions.length > optionIndex) {
      const selectedInput = currentOptions[optionIndex];
      if (selectedInput.disabled) {
        console.log('Input is disabled, checking if we can go to next question');
        if (userAnswers[currentQuestionIndex] === selectedInput.value) {
          console.log('Going to next question');
          goToNextQuestion();
        }
        return;
      }
      console.log('Selecting option:', selectedInput.value);
      selectedInput.checked = true;
      userAnswers[currentQuestionIndex] = selectedInput.value;
      highlightCorrectAnswer();
    }
  }
  if (e.key === 'ArrowRight') {
    console.log('Arrow right pressed');
    goToNextQuestion();
  }
  if (e.key === 'ArrowLeft') {
    console.log('Arrow left pressed');
    goToPreviousQuestion();
  }
  if (e.key === 'Enter') {
    console.log('Enter key pressed');
    const checkedOption = document.querySelector('.current-question .form-check-input:checked');
    if (checkedOption && !checkedOption.disabled) {
      console.log('Highlighting answer');
      highlightCorrectAnswer();
    } else {
      console.log('No option checked or already highlighted');
    }
  }
};

// Initialize application
async function init() {
  try {
    const categories = await fetchTestCategories();
    const categoryContainer = document.getElementById('category-container');
    categoryContainer.innerHTML = '<h3 class="mb-3">Выберите категорию тестов</h3>';
    const categoryButtonsRow = document.createElement('div');
    categoryButtonsRow.className = 'row mb-4';
    for (const [categoryId, categoryName] of Object.entries(categories)) {
      const col = document.createElement('div');
      col.className = 'col-md-4 mb-3';
      const button = document.createElement('button');
      button.className = 'btn btn-primary btn-lg w-100 h-100 d-flex align-items-center justify-content-center';
      button.setAttribute('data-category', categoryId);
      button.innerHTML = `<span>${categoryName}</span>`;
      button.addEventListener('click', function() {
        document.querySelectorAll('#category-container button').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');
        currentCategory = categoryId;
        loadTestsForCategory(categoryId);
      });
      col.appendChild(button);
      categoryButtonsRow.appendChild(col);
    }
    categoryContainer.appendChild(categoryButtonsRow);
    const selector = document.getElementById('test-selector');
    selector.innerHTML = '<option value="">Сначала выберите категорию</option>';
    selector.onchange = async () => {
      selector.blur();
      if (!selector.value) return;
      if (!currentCategory) {
        alert('Пожалуйста, выберите категорию тестов');
        selector.value = '';
        return;
      }
      currentTestName = selector.options[selector.selectedIndex].textContent;
      document.getElementById('test-container').innerHTML = `
        <div class="text-center py-5">
          <span class="loader"></span>
          <p class="mt-3">Загрузка содержимого теста...</p>
        </div>
      `;
      try {
        const content = await fetchTestFile(currentCategory, selector.value);
        currentQuestions = parseTest(content);
        currentQuestions = shuffle(currentQuestions);
        const testInfo = document.getElementById('test-info');
        testInfo.classList.remove('d-none');
        const questionCountElement = document.getElementById('question-count');
        if (questionCountElement) {
          questionCountElement.textContent = currentQuestions.length;
        } else {
          console.warn('Элемент с ID "question-count" не найден в DOM');
        }
        const filenameMatch = selector.value.match(/(\d+)\.txt$/);
        if (filenameMatch && parseInt(filenameMatch[1]) !== currentQuestions.length) {
          console.warn(`Внимание: В названии файла указано ${filenameMatch[1]} вопросов, но найдено только ${currentQuestions.length}`);
        }
        displayTest(currentQuestions);
      } catch (error) {
        document.getElementById('test-container').innerHTML = `
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Ошибка загрузки теста: ${error.message}
          </div>
        `;
        console.error('Ошибка в selector.onchange:', error);
      }
    };
  } catch (error) {
    const categoryContainer = document.getElementById('category-container');
    categoryContainer.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Ошибка инициализации: ${error.message}
      </div>
    `;
    console.error('Failed to initialize:', error);
  }
}

// Load tests for selected category
async function loadTestsForCategory(category) {
  const selector = document.getElementById('test-selector');
  selector.innerHTML = '<option value="">Загрузка тестов...</option>';
  try {
    const tests = await fetchTestList(category);
    selector.innerHTML = '<option value="">Выберите тест</option>';
    tests.forEach(test => {
      const option = document.createElement('option');
      option.value = test;
      option.textContent = test;
      selector.appendChild(option);
    });
    document.getElementById('test-selector-container').classList.remove('d-none');
    const runAllButton = document.getElementById('run-all-tests-btn');
    if (runAllButton) {
      const newRunAllButton = runAllButton.cloneNode(true);
      runAllButton.parentNode.replaceChild(newRunAllButton, runAllButton);
      newRunAllButton.addEventListener('click', function() {
        console.log('Run all tests button clicked for category:', category);
        startAllCategoryTests();
      });
    }
  } catch (error) {
    selector.innerHTML = '<option value="">Ошибка загрузки тестов</option>';
    console.error(`Failed to load tests for category ${category}:`, error);
  }
}

// Fetch list of test categories
async function fetchTestCategories() {
  const response = await fetch('/test_categories');
  if (!response.ok) {
    throw new Error('Не удалось получить список категорий тестов');
  }
  return await response.json();
}

// Fetch list of available tests for a category
async function fetchTestList(category) {
  const response = await fetch(`/tests/${category}`);
  if (!response.ok) {
    throw new Error('Не удалось получить список тестов');
  }
  return await response.json();
}

// Fetch test file content
async function fetchTestFile(category, filename) {
  const response = await fetch(`/tests/${category}/${filename}`);
  if (!response.ok) {
    throw new Error('Не удалось загрузить содержимое теста');
  }
  return await response.text();
}

// Parse test content
function parseTest(content) {
  console.log("Начинаем парсинг теста");
  let processedContent = '';
  const contentLines = content.split('\n');
  let hasPlusMinusFormat = false;
  for (const line of contentLines) {
    if (line.trim().startsWith('+') || line.trim().startsWith('-')) {
      hasPlusMinusFormat = true;
      break;
    }
  }
  console.log("Формат теста с +/- символами: " + (hasPlusMinusFormat ? "Да" : "Нет"));
  for (const line of contentLines) {
    let processedLine = line;
    if (line.trim().startsWith('?')) {
      processedLine = line.replace(/^\s*\?\s*/, '<question>');
    } else if (line.trim().startsWith('+')) {
      processedLine = line.replace(/^\s*\+\s*/, '<variant>+++');
    } else if (line.trim().startsWith('-')) {
      processedLine = line.replace(/^\s*\-\s*/, '<variant>');
    }
    processedContent += processedLine + '\n';
  }
  const lines = processedContent.split('\n');
  const questions = [];
  let currentQuestion = null;
  let currentVariants = [];
  let correctAnswerIndex = 0;
  const MAX_VARIANTS = 5;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    if (
      trimmedLine.startsWith('<question>') ||
      trimmedLine.startsWith('<question ') ||
      trimmedLine.match(/^<question\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question\s*>/)
    ) {
      if (currentQuestion) {
        if (currentVariants.length > MAX_VARIANTS) {
          console.warn(`Вопрос "${currentQuestion}" имеет ${currentVariants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
          currentVariants = currentVariants.slice(0, MAX_VARIANTS);
        }
        if (correctAnswerIndex >= currentVariants.length) {
          correctAnswerIndex = 0;
          console.warn(`Индекс правильного ответа превышает количество вариантов, устанавливаем первый вариант как правильный.`);
        }
        questions.push({
          q: currentQuestion,
          variants: currentVariants,
          answer: currentVariants[correctAnswerIndex]
        });
        console.log(`Добавлен вопрос "${currentQuestion}" с ${currentVariants.length} вариантами. Правильный ответ: "${currentVariants[correctAnswerIndex]}"`);
      }
      let questionText = trimmedLine;
      if (questionText.match(/^\d+(\.\d+)*\s*\./)) {
        questionText = questionText.replace(/^\d+(\.\d+)*\s*\./, '').trim();
      }
      if (questionText.startsWith('<question>')) {
        questionText = questionText.replace('<question>', '');
      } else if (questionText.match(/^<question\s*>/)) {
        questionText = questionText.replace(/^<question\s*>/, '');
      }
      currentQuestion = questionText.trim();
      currentVariants = [];
      correctAnswerIndex = 0;
      console.log(`Обрабатываем новый вопрос: "${currentQuestion}"`);
    } else if (
      trimmedLine.startsWith('<variant>') ||
      trimmedLine.startsWith('<variant ') ||
      trimmedLine.match(/^<variant\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant\s*>/)
    ) {
      let text = trimmedLine;
      const isCorrectVariant = text.includes('+++');
      if (text.match(/^\d+(\.\d+)*\s*\./)) {
        text = text.replace(/^\d+(\.\d+)*\s*\./, '').trim();
      }
      if (text.startsWith('<variant>')) {
        text = text.replace('<variant>', '');
      } else if (text.match(/^<variant\s*>/)) {
        text = text.replace(/^<variant\s*>/, '');
      } else if (text.match(/^\d+\s*\.\s*<variant>/)) {
        text = text.replace(/^\d+\s*\.\s*<variant>/, '');
      } else if (text.match(/^\d+\s*\.\s*<variant\s*>/)) {
        text = text.replace(/^\d+\s*\.\s*<variant\s*>/, '');
      }
      const cleanText = text.replace('+++', '').replace('$correct', '').trim();
      if (currentQuestion && cleanText) {
        if (isCorrectVariant && currentVariants.length < MAX_VARIANTS) {
          correctAnswerIndex = currentVariants.length;
          console.log(`Найден правильный ответ для вопроса "${currentQuestion}": "${cleanText}" (индекс ${correctAnswerIndex})`);
        }
        if (currentVariants.length < MAX_VARIANTS) {
          currentVariants.push(cleanText);
        }
      }
    }
  }
  if (currentQuestion) {
    if (currentVariants.length > MAX_VARIANTS) {
      console.warn(`Вопрос "${currentQuestion}" имеет ${currentVariants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
      currentVariants = currentVariants.slice(0, MAX_VARIANTS);
    }
    if (correctAnswerIndex >= currentVariants.length) {
      correctAnswerIndex = 0;
      console.warn(`Индекс правильного ответа превышает количество вариантов, устанавливаем первый вариант как правильный.`);
    }
    questions.push({
      q: currentQuestion,
      variants: currentVariants,
      answer: currentVariants[correctAnswerIndex]
    });
    console.log(`Добавлен последний вопрос "${currentQuestion}" с ${currentVariants.length} вариантами. Правильный ответ: "${currentVariants[correctAnswerIndex]}"`);
  }
  console.log(`Всего распознано ${questions.length} вопросов с правильными ответами`);
  if (questions.length === 0) {
    console.warn('В тесте не найдено ни одного вопроса!');
    return questions;
  }
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].variants.length === 0) {
      console.warn(`Вопрос "${questions[i].q}" не имеет вариантов ответа!`);
    }
    console.log(`Вопрос ${i+1}: "${questions[i].q}" - правильный ответ: "${questions[i].answer}"`);
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

// Display test questions
function displayTest(questions) {
  currentQuestionIndex = 0;
  userAnswers = new Array(questions.length).fill(null);
  incorrectQuestions = [];
  displayCurrentQuestion();
}

// Display the current question
function displayCurrentQuestion() {
  const container = document.getElementById('test-container');
  container.innerHTML = '';
  const testTitle = document.createElement('h2');
  testTitle.className = 'h4 mb-4';
  testTitle.innerHTML = `<i class="fas fa-heartbeat text-danger me-2"></i> ${currentTestName}`;
  container.appendChild(testTitle);
  const progressInfo = document.createElement('div');
  progressInfo.className = 'test-progress mb-3';
  progressInfo.innerHTML = `
    <span class="badge bg-secondary">
      Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}
    </span>
  `;
  container.appendChild(progressInfo);
  const q = currentQuestions[currentQuestionIndex];
  const card = document.createElement('div');
  card.className = 'card question-card mb-4 current-question';
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';
  const questionText = document.createElement('h3');
  questionText.className = 'h5 mb-3';
  questionText.textContent = q.q;
  cardBody.appendChild(questionText);
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
    if (userAnswers[currentQuestionIndex] === variant) {
      input.checked = true;
    }
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = optionId;
    label.innerHTML = `<strong>${varIndex + 1}.</strong> ${variant}`;
    input.addEventListener('change', function() {
      userAnswers[currentQuestionIndex] = this.value;
      highlightCorrectAnswer();
      setTimeout(() => {
        if (currentQuestionIndex < currentQuestions.length - 1) {
          goToNextQuestion();
        }
      }, 600);
    });
    formCheck.appendChild(input);
    formCheck.appendChild(label);
    optionsContainer.appendChild(formCheck);
  });
  cardBody.appendChild(optionsContainer);
  card.appendChild(cardBody);
  container.appendChild(card);
  const navContainer = document.createElement('div');
  navContainer.className = 'd-flex justify-content-between my-3 navigation-buttons';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-outline-secondary';
  prevBtn.innerHTML = '<i class="fas fa-arrow-left me-2"></i>Предыдущий вопрос';
  prevBtn.disabled = currentQuestionIndex === 0;
  prevBtn.onclick = goToPreviousQuestion;
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-outline-primary';
  nextBtn.innerHTML = 'Следующий вопрос<i class="fas fa-arrow-right ms-2"></i>';
  nextBtn.disabled = currentQuestionIndex === currentQuestions.length - 1;
  nextBtn.onclick = goToNextQuestion;
  navContainer.appendChild(prevBtn);
  navContainer.appendChild(nextBtn);
  container.appendChild(navContainer);
  if (currentQuestionIndex === currentQuestions.length - 1 || userAnswers.every(a => a !== null)) {
    const finishContainer = document.createElement('div');
    finishContainer.className = 'd-grid gap-2 mx-auto my-4';
    const finishBtn = document.createElement('button');
    finishBtn.className = 'btn btn-success btn-lg';
    finishBtn.innerHTML = allTestsMode
      ? `<i class="fas fa-check-circle me-2"></i>Завершить тест ${currentTestIndex + 1} из ${allCategoryTests.length}`
      : '<i class="fas fa-check-circle me-2"></i>Завершить тест';
    finishBtn.onclick = finishTest;
    finishContainer.appendChild(finishBtn);
    container.appendChild(finishContainer);
  }
  const keyboardHint = document.createElement('div');
  keyboardHint.className = 'alert alert-info mt-3';
  keyboardHint.innerHTML = 'Используйте клавиши 1-5 для выбора ответа, стрелки для навигации, Enter для подтверждения.';
  container.appendChild(keyboardHint);
}

// Go to next question
function goToNextQuestion() {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    displayCurrentQuestion();
  }
}

// Go to previous question
function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayCurrentQuestion();
  }
}

// Highlight correct answer
function highlightCorrectAnswer() {
  const currentQuestion = currentQuestions[currentQuestionIndex];
  const correctAnswer = currentQuestion.answer;
  const options = document.querySelectorAll('.current-question .form-check');
  const userAnswer = userAnswers[currentQuestionIndex];
  const normalizedUserAnswer = userAnswer ? userAnswer.trim().toLowerCase() : '';
  const normalizedCorrectAnswer = correctAnswer.trim().toLowerCase();
  const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
  options.forEach(option => {
    const input = option.querySelector('input');
    const label = option.querySelector('label');
    if (input.value === correctAnswer) {
      option.classList.add('option-correct');
      if (!label.innerHTML.includes('fa-check')) {
        label.innerHTML += ' <i class="fas fa-check text-success"></i>';
      }
    } else if (input.checked) {
      if (!isCorrect) {
        option.classList.add('option-incorrect');
        if (!label.innerHTML.includes('fa-times')) {
          label.innerHTML += ' <i class="fas fa-times text-danger"></i>';
        }
      }
    }
    input.disabled = true;
  });
  const questionCard = document.querySelector('.current-question');
  if (isCorrect) {
    questionCard.classList.add('correct-answer');
  } else {
    questionCard.classList.add('incorrect-answer');
  }
}

// Finish the test and show results
function finishTest() {
  let score = 0;
  let totalAnswered = 0;
  incorrectQuestions = [];
  console.log("================================");
  console.log("НАЧИНАЕМ ПРОВЕРКУ РЕЗУЛЬТАТОВ ТЕСТА");
  console.log(`Всего вопросов: ${currentQuestions.length}, ответов: ${userAnswers.filter(a => a !== null).length}`);
  console.log("================================");
  userAnswers.forEach((answer, index) => {
    if (answer !== null) {
      console.log(`Ответ #${index+1}: "${answer}"`);
    }
  });
  currentQuestions.forEach((q, i) => {
    const userAnswer = userAnswers[i];
    if (userAnswer !== null) {
      totalAnswered++;
      const correctAnswer = q.answer;
      const normalizedUserAnswer = userAnswer.trim().toLowerCase();
      const normalizedCorrectAnswer = correctAnswer.trim().toLowerCase();
      console.log(`\nПРОВЕРКА ВОПРОСА #${i+1}: "${q.q.substring(0, 50)}..."`);
      console.log(`Ответ пользователя: "${userAnswer}"`);
      console.log(`Правильный ответ: "${correctAnswer}"`);
      let isCorrect = false;
      if (userAnswer === correctAnswer) {
        console.log("✓ Точное совпадение!");
        isCorrect = true;
      } else if (normalizedUserAnswer === normalizedCorrectAnswer) {
        console.log("✓ Совпадение после нормализации!");
        isCorrect = true;
      } else if (normalizedUserAnswer.includes(normalizedCorrectAnswer)) {
        console.log("✓ Правильный ответ содержится в ответе пользователя!");
        isCorrect = true;
      } else if (normalizedCorrectAnswer.includes(normalizedUserAnswer)) {
        console.log("✓ Ответ пользователя содержится в правильном ответе!");
        isCorrect = true;
      } else if (
        normalizedUserAnswer.split(' ')[0] === normalizedCorrectAnswer.split(' ')[0] &&
        normalizedUserAnswer.length > 5 && normalizedCorrectAnswer.length > 5
      ) {
        console.log("✓ Совпадение по первым словам!");
        isCorrect = true;
      } else {
        console.log("✗ Ответы не совпадают ни по одному из критериев");
      }
      console.log(`Итоговая оценка: ${isCorrect ? 'ВЕРНО' : 'НЕВЕРНО'}`);
      if (isCorrect) {
        score++;
      } else {
        incorrectQuestions.push({
          question: q.q,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          allVariants: q.variants || [],
          correctAnswerIndex: (q.variants || []).indexOf(correctAnswer)
        });
        console.log(`Добавлен в список неправильных ответов. Всего неправильных: ${incorrectQuestions.length}`);
      }
    }
  });
  const resultsContainer = document.getElementById('results-container');
  const scoreFraction = document.getElementById('score-fraction');
  const scorePercentage = document.getElementById('score-percentage');
  const scoreProgress = document.getElementById('score-progress');
  const totalQuestions = currentQuestions.length;
  const percentage = totalAnswered > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  scoreFraction.textContent = `${score} / ${totalQuestions}`;
  scorePercentage.textContent = `${percentage}%`;
  scoreProgress.style.width = `${percentage}%`;
  if (percentage >= 80) {
    scoreProgress.className = 'progress-bar bg-success';
  } else if (percentage >= 60) {
    scoreProgress.className = 'progress-bar bg-warning';
  } else {
    scoreProgress.className = 'progress-bar bg-danger';
  }
  const resultDetails = document.getElementById('result-details');
  if (resultDetails) {
    resultDetails.textContent = totalAnswered < totalQuestions
      ? `Вы ответили на ${totalAnswered} из ${totalQuestions} вопросов. Правильных ответов: ${score}.`
      : `Правильных ответов: ${score} из ${totalQuestions}.`;
  }
  displayIncorrectAnswers();
  resultsContainer.classList.remove('d-none');
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
  if (incorrectQuestions.length > 0) {
    const retryErrorsBtn = document.createElement('button');
    retryErrorsBtn.className = 'btn btn-outline-danger mt-4';
    retryErrorsBtn.innerHTML = '<i class="fas fa-redo-alt me-2"></i>Повторить только неправильные вопросы';
    retryErrorsBtn.onclick = retryIncorrectQuestions;
    resultsContainer.appendChild(retryErrorsBtn);
  }
  console.log(`Итоговая статистика: ${score} правильных из ${totalAnswered} отвеченных (${percentage}%)`);
}

// Display incorrect answers
function displayIncorrectAnswers() {
  const container = document.getElementById('incorrect-answers-container');
  container.innerHTML = '';
  if (incorrectQuestions.length === 0) {
    container.classList.add('d-none');
    return;
  }
  const header = document.createElement('h3');
  header.className = 'h5 mb-3';
  header.innerHTML = '<i class="fas fa-exclamation-triangle text-warning me-2"></i>Самые сложные вопросы для вас:';
  container.appendChild(header);
  const list = document.createElement('div');
  list.className = 'list-group mb-4';
  for (let i = 0; i < incorrectQuestions.length; i++) {
    const item = incorrectQuestions[i];
    const questionNumber = i + 1;
    let originalQuestionIndex = -1;
    let originalQuestion = null;
    console.log(`Ищем оригинальный вопрос для: "${item.question}"`);
    for (let j = 0; j < currentQuestions.length; j++) {
      if (currentQuestions[j].q === item.question) {
        originalQuestionIndex = j;
        originalQuestion = currentQuestions[j];
        break;
      }
    }
    const listItem = document.createElement('div');
    listItem.className = 'list-group-item';
    let content = `
      <div class="d-flex w-100 justify-content-between">
        <h5 class="mb-1">Вопрос ${questionNumber}</h5>
      </div>
      <p class="mb-1">${item.question}</p>
      <div class="d-flex flex-column mt-2">
        <small class="text-danger">
          <i class="fas fa-times me-2"></i>
          Ваш ответ: ${item.userAnswer}
        </small>`;
    if (originalQuestion) {
      console.log(`Найден оригинальный вопрос: "${originalQuestion.q}" с правильным ответом: "${originalQuestion.answer}"`);
      content += `
        <small class="text-success">
          <i class="fas fa-check me-2"></i>
          Правильный ответ: ${originalQuestion.answer}
        </small>`;
    } else {
      console.log(`Не найден оригинальный вопрос, используем сохраненный ответ: "${item.correctAnswer}"`);
      content += `
        <small class="text-success">
          <i class="fas fa-check me-2"></i>
          Правильный ответ: ${item.correctAnswer}
        </small>`;
    }
    content += `</div>`;
    listItem.innerHTML = content;
    list.appendChild(listItem);
  }
  container.appendChild(list);
  container.classList.remove('d-none');
}

// Start all category tests
async function startAllCategoryTests() {
  try {
    document.getElementById('test-container').innerHTML = `
      <div class="text-center py-5">
        <span class="loader"></span>
        <p class="mt-3">Загрузка всех тестов категории...</p>
      </div>
    `;
    allCategoryTests = await fetchTestList(currentCategory);
    if (allCategoryTests.length === 0) {
      document.getElementById('test-container').innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          В данной категории нет тестов.
        </div>
      `;
      return;
    }
    document.getElementById('test-info').innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        Загрузка всех вопросов из категории. Всего тестов: <strong>${allCategoryTests.length}</strong>
        <br>Загружено: <span id="loaded-tests-count">0</span> из ${allCategoryTests.length}
      </div>
    `;
    document.getElementById('test-info').classList.remove('d-none');
    let allQuestions = [];
    let loadedCount = 0;
    const loadingPromises = allCategoryTests.map(testFilename =>
      fetchTestFile(currentCategory, testFilename)
        .then(content => {
          const questions = parseTest(content);
          questions.forEach(q => {
            q.sourceTest = testFilename;
          });
          loadedCount++;
          document.getElementById('loaded-tests-count').textContent = loadedCount;
          return questions;
        })
        .catch(error => {
          console.error(`Error loading test ${testFilename}:`, error);
          return [];
        })
    );
    const results = await Promise.all(loadingPromises);
    results.forEach(questions => {
      allQuestions = allQuestions.concat(questions);
    });
    if (allQuestions.length === 0) {
      document.getElementById('test-container').innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Не удалось загрузить вопросы из тестов.
        </div>
      `;
      return;
    }
    allQuestions = shuffle(allQuestions);
    currentQuestions = allQuestions;
    currentTestName = `Все вопросы из категории (${allQuestions.length} вопросов, случайный порядок)`;
    document.getElementById('test-info').innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        Загружено ${allQuestions.length} вопросов из ${allCategoryTests.length} тестов в случайном порядке.
      </div>
    `;
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    incorrectQuestions = [];
    displayCurrentQuestion();
  } catch (error) {
    document.getElementById('test-container').innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Ошибка при загрузке тестов: ${error.message}
      </div>
    `;
    console.error('Error starting all category tests:', error);
  }
}

// Prepare test source stats
function prepareTestSourceStats(allQuestions, userAnswers) {
  const testStats = {};
  for (let i = 0; i < allQuestions.length; i++) {
    const question = allQuestions[i];
    const sourceTest = question.sourceTest || 'Неизвестный тест';
    if (!testStats[sourceTest]) {
      testStats[sourceTest] = {
        total: 0,
        correct: 0
      };
    }
    testStats[sourceTest].total++;
    if (userAnswers[i] && userAnswers[i].trim().toLowerCase() === question.answer.trim().toLowerCase()) {
      testStats[sourceTest].correct++;
    }
  }
  return Object.entries(testStats).map(([testName, stats]) => ({
    testName,
    total: stats.total,
    correct: stats.correct
  }));
}

// Retry incorrect questions
function retryIncorrectQuestions() {
  if (incorrectQuestions.length === 0) {
    alert('Нет неправильных ответов для повторения!');
    return;
  }
  currentQuestions = incorrectQuestions.map(item => ({
    q: item.question,
    variants: item.allVariants || [],
    answer: item.correctAnswer
  }));
  currentTestName = 'Повторение ошибок';
  currentQuestionIndex = 0;
  userAnswers = new Array(currentQuestions.length).fill(null);
  incorrectQuestions = [];
  displayCurrentQuestion();
  document.getElementById('results-container').classList.add('d-none');
  document.getElementById('incorrect-answers-container').classList.add('d-none');
}
