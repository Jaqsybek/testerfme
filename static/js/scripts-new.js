// Global variables
let currentQuestions = [];
let currentTestName = '';
let currentQuestionIndex = 0;
let userAnswers = [];
let incorrectQuestions = [];
let currentCategory = null;
let allTestsMode = false; // Добавляем переменную для режима всех тестов

// Переменные для категории тестов
let allCategoryTests = [];
let currentTestIndex = 0;

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Document ready, initializing application');
  init();
  
  // Event listeners for retry and choose new test buttons
  document.getElementById('retry-btn').addEventListener('click', function() {
    // Повторить текущий тест
    resetTest();
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
  });
  
  document.getElementById('new-test-btn').addEventListener('click', function() {
    // Сбросить переменные и вернуться к выбору тестов
    allCategoryTests = [];
    currentTestIndex = 0;
    
    document.getElementById('results-container').classList.add('d-none');
    document.getElementById('incorrect-answers-container').classList.add('d-none');
    document.getElementById('test-container').innerHTML = '';
    document.getElementById('test-info').classList.add('d-none');
    document.getElementById('test-selector').value = '';
  });
  
  // Обработчик для кнопки "Пройти все тесты в категории" добавляется после загрузки категории
  // Он будет добавлен динамически в функции loadTestsForCategory
});

// Отдельный глобальный обработчик клавиатуры (более надёжный)
window.onkeydown = function(e) {
  // Защита: если фокус в select, input или textarea — не мешаем
  const tag = document.activeElement.tagName.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    return;
  }

  // Ниже — твоя существующая логика...

  
  // Проверяем, что вопросы загружены и тест активен
  if (currentQuestions.length === 0) {
    console.log('Ignoring key press: no questions loaded');
    return; // Игнорируем нажатия клавиш, если вопросы не загружены
  }
  
  // Проверяем, что результаты не отображаются (тест в процессе)
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) {
    console.log('Ignoring key press: results container not found');
    return;
  }
  
  // Если результаты видимы (не скрыты), то игнорируем нажатия клавиш
  if (!resultsContainer.classList.contains('d-none')) {
    console.log('Ignoring key press: results are shown (container not hidden)');
    return;
  }
  
  // Проверка, что контейнер теста не пустой и есть текущий вопрос
  const currentQuestion = document.querySelector('.current-question');
  if (!currentQuestion) {
    console.log('Ignoring key press: no current question found');
    return; // Игнорируем нажатия клавиш, если нет текущего вопроса
  }
  
  // Number keys 1-5
  if (e.key >= '1' && e.key <= '5') {
    console.log('Number key pressed:', e.key);
    const optionIndex = parseInt(e.key) - 1;
    const currentOptions = document.querySelectorAll('.current-question .form-check-input');
    console.log('Options found:', currentOptions.length, 'Looking for index:', optionIndex);
    
    if (currentOptions.length > optionIndex) {
      const selectedInput = currentOptions[optionIndex];
      
      // If the input is already disabled (answer already shown)
      if (selectedInput.disabled) {
        console.log('Input is disabled, checking if we can go to next question');
        // If pressing the same key as before, go to next question
        if (userAnswers[currentQuestionIndex] === selectedInput.value) {
          console.log('Going to next question');
          goToNextQuestion();
        }
        return;
      }
      
      // Select the option
      console.log('Selecting option:', selectedInput.value);
      selectedInput.checked = true;
      userAnswers[currentQuestionIndex] = selectedInput.value;
      
      // Show the correct answer immediately
      highlightCorrectAnswer();
    }
  }
  
  // Right arrow key to go to next question after selecting an answer
  if (e.key === 'ArrowRight') {
    console.log('Arrow right pressed');
    goToNextQuestion();
  }
  
  // Left arrow key to go to previous question
  if (e.key === 'ArrowLeft') {
    console.log('Arrow left pressed');
    goToPreviousQuestion();
  }
  
  // Enter key to confirm the selected answer
  if (e.key === 'Enter') {
    console.log('Enter key pressed');
    const checkedOption = document.querySelector('.current-question .form-check-input:checked');
    if (checkedOption && !checkedOption.disabled) {
      // Only highlight if not already highlighted
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
    // Fetch test categories
    const categories = await fetchTestCategories();
    
    // Create category elements
    const categoryContainer = document.getElementById('category-container');
    categoryContainer.innerHTML = '<h3 class="mb-3">Выберите категорию тестов</h3>';
    
    // Create buttons for each category
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
        // Mark this button as active and deactivate others
        document.querySelectorAll('#category-container button').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Store selected category
        currentCategory = categoryId;
        
        // Load tests for this category
        loadTestsForCategory(categoryId);
      });
      
      col.appendChild(button);
      categoryButtonsRow.appendChild(col);
    }
    
    categoryContainer.appendChild(categoryButtonsRow);
    
    // Setup test selector
    const selector = document.getElementById('test-selector');
    selector.innerHTML = '<option value="">Сначала выберите категорию</option>';
    
    // Handle test selection
    selector.onchange = async () => {
      if (!selector.value) return;
      
      // Get the selected category
      if (!currentCategory) {
        alert('Пожалуйста, выберите категорию тестов');
        selector.value = '';
        return;
      }
      
      currentTestName = selector.options[selector.selectedIndex].textContent;
      
      // Show loading message
      document.getElementById('test-container').innerHTML = `
        <div class="text-center py-5">
          <span class="loader"></span>
          <p class="mt-3">Загрузка содержимого теста...</p>
        </div>
      `;
      
      try {
        // Fetch and parse test file
        const content = await fetchTestFile(currentCategory, selector.value);
        currentQuestions = parseTest(content);
        
        // Перемешиваем вопросы в случайном порядке
        currentQuestions = shuffle(currentQuestions);
        
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
            Ошибка загрузки теста: ${error.message}
          </div>
        `;
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
    // Fetch list of tests for this category
    const tests = await fetchTestList(category);
    
    // Clear loading message
    selector.innerHTML = '<option value="">Выберите тест</option>';
    
    // Add options to select
    tests.forEach(test => {
      const option = document.createElement('option');
      option.value = test;
      option.textContent = test;
      selector.appendChild(option);
    });
    
    // Show the test selector
    document.getElementById('test-selector-container').classList.remove('d-none');
    
    // Добавляем обработчик события для кнопки "Пройти все тесты"
    const runAllButton = document.getElementById('run-all-tests-btn');
    if (runAllButton) {
      // Удалить старые обработчики, если они есть
      const newRunAllButton = runAllButton.cloneNode(true);
      runAllButton.parentNode.replaceChild(newRunAllButton, runAllButton);
      
      // Добавить новый обработчик
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
  
  // Предварительная обработка для замены символов ? на <question> и +/- на <variant>
  let processedContent = '';
  const contentLines = content.split('\n');
  
  // Проверяем, использует ли тест символы +/- для маркировки вариантов
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
    
    // Замена символа "?" в начале строки на <question>
    if (line.trim().startsWith('?')) {
      processedLine = line.replace(/^\s*\?\s*/, '<question>');
    }
    // Замена символов "+" (правильный вариант) в начале строки на <variant>+++
    else if (line.trim().startsWith('+')) {
      processedLine = line.replace(/^\s*\+\s*/, '<variant>+++');
    }
    // Замена символов "-" (неправильный вариант) в начале строки на <variant>
    else if (line.trim().startsWith('-')) {
      processedLine = line.replace(/^\s*\-\s*/, '<variant>');
    }
    
    processedContent += processedLine + '\n';
  }
  
  // Разбираем обработанные данные
  const lines = processedContent.split('\n');
  const questions = [];
  let currentQuestion = null;
  let currentVariants = []; // Для временного хранения вариантов текущего вопроса
  let correctAnswerIndex = 0; // Индекс правильного ответа
  const MAX_VARIANTS = 5; // Ограничиваем количество вариантов ответа до 5

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Проверяем различные варианты форматирования тега question:
    if (
      trimmedLine.startsWith('<question>') || 
      trimmedLine.startsWith('<question ') || 
      trimmedLine.match(/^<question\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<question\s*>/)
    ) {
      // Если у нас есть предыдущий вопрос, добавляем его в массив
      if (currentQuestion) {
        // Если у вопроса больше 5 вариантов, оставляем только первые 5
        if (currentVariants.length > MAX_VARIANTS) {
          console.warn(`Вопрос "${currentQuestion}" имеет ${currentVariants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
          currentVariants = currentVariants.slice(0, MAX_VARIANTS);
        }
        
        // Проверяем, не превышает ли индекс правильного ответа количество вариантов
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
      
      // Начинаем новый вопрос
      currentQuestion = questionText.trim();
      currentVariants = [];
      correctAnswerIndex = 0; // По умолчанию первый вариант правильный
      
      console.log(`Обрабатываем новый вопрос: "${currentQuestion}"`);
    }
    // Проверяем различные варианты форматирования тега variant:
    else if (
      trimmedLine.startsWith('<variant>') || 
      trimmedLine.startsWith('<variant ') || 
      trimmedLine.match(/^<variant\s*>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant>/) ||
      trimmedLine.match(/^\d+\s*\.\s*<variant\s*>/)
    ) {
      // Извлекаем текст варианта ответа, обрабатывая разные форматы тега
      let text = trimmedLine;
      
      // Проверяем, помечен ли этот вариант как правильный
      const isCorrectVariant = text.includes('+++');
      
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
      // Удаляем все маркеры правильного ответа из текста
      const cleanText = text.replace('+++', '').replace('$correct', '').trim();
      
      // Если это текущий вопрос и есть текст варианта
      if (currentQuestion && cleanText) {
        // Если это вариант с маркером правильного ответа +++
        if (isCorrectVariant && currentVariants.length < MAX_VARIANTS) {
          // Запоминаем индекс правильного варианта
          correctAnswerIndex = currentVariants.length;
          console.log(`Найден правильный ответ для вопроса "${currentQuestion}": "${cleanText}" (индекс ${correctAnswerIndex})`);
        }
        
        // Добавляем вариант в список (если не превышен лимит)
        if (currentVariants.length < MAX_VARIANTS) {
          currentVariants.push(cleanText);
        }
      }
    }
  }
  
  // Не забудем обработать последний вопрос
  if (currentQuestion) {
    // Если у вопроса больше 5 вариантов, оставляем только первые 5
    if (currentVariants.length > MAX_VARIANTS) {
      console.warn(`Вопрос "${currentQuestion}" имеет ${currentVariants.length} вариантов. Оставляем только первые ${MAX_VARIANTS}.`);
      currentVariants = currentVariants.slice(0, MAX_VARIANTS);
    }
    
    // Проверяем, не превышает ли индекс правильного ответа количество вариантов
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
  
  // Если в тесте нет вопросов, возвращаем пустой массив
  if (questions.length === 0) {
    console.warn('В тесте не найдено ни одного вопроса!');
    return questions;
  }
  
  // Проверяем, что у всех вопросов есть хотя бы один вариант ответа
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].variants.length === 0) {
      console.warn(`Вопрос "${questions[i].q}" не имеет вариантов ответа!`);
    }
    console.log(`Вопрос ${i+1}: "${questions[i].q}" - правильный ответ: "${questions[i].answer}"`);
  }
  
  // Возвращаем вопросы (их можно перемешать, но не обязательно)
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
    
    // Add click event listener to show correct answer AND automatically navigate to next question
    input.addEventListener('change', function() {
      userAnswers[currentQuestionIndex] = this.value;
      
      // Highlight the correct answer immediately
      highlightCorrectAnswer();
      
      // Automatically go to next question after a delay
      setTimeout(() => {
        // Только если это не последний вопрос
        if (currentQuestionIndex < currentQuestions.length - 1) {
          goToNextQuestion();
        }
      }, 6000000000); // Задержка в 60000 секунд перед переходом
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
    
    // Отображаем разный текст в зависимости от режима
    if (allTestsMode) {
      finishBtn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Завершить тест ${currentTestIndex + 1} из ${allCategoryTests.length}`;
    } else {
      finishBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Завершить тест его величества Жаксыбека';
    }
    finishBtn.onclick = finishTest;
    
    finishContainer.appendChild(finishBtn);
    container.appendChild(finishContainer);
    
    // Кнопка пропуска больше не нужна, так как мы загружаем все вопросы сразу
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
  
  // Нормализуем строки для более точного сравнения
  const normalizedUserAnswer = selectedAnswer ? selectedAnswer.trim().toLowerCase() : '';
  const normalizedCorrectAnswer = correctAnswer ? correctAnswer.trim().toLowerCase() : '';
  
  console.log(`Выбран ответ: "${selectedAnswer}"`);
  console.log(`Правильный ответ: "${correctAnswer}"`);
  
  // Проверяем более гибким способом (точное совпадение или включение)
  let isCorrect = normalizedUserAnswer === normalizedCorrectAnswer || 
                 normalizedUserAnswer.includes(normalizedCorrectAnswer) ||
                 normalizedCorrectAnswer.includes(normalizedUserAnswer);
  
  // Дополнительная проверка по первым словам для сложных ответов
  if (!isCorrect && normalizedUserAnswer && normalizedCorrectAnswer &&
      normalizedUserAnswer.split(' ')[0] === normalizedCorrectAnswer.split(' ')[0] && 
      normalizedUserAnswer.length > 5 && normalizedCorrectAnswer.length > 5) {
    isCorrect = true;
  }
  
  console.log(`Совпадение ответов: ${isCorrect ? 'Да' : 'Нет'}`);
  
  // Highlight correct and incorrect options
  options.forEach(option => {
    const input = option.querySelector('input');
    const label = option.querySelector('label');
    
    if (input.value === correctAnswer) {
      // Правильный ответ
      option.classList.add('option-correct');
      if (!label.innerHTML.includes('fa-check')) {
        label.innerHTML += ' <i class="fas fa-check text-success"></i>';
      }
    } else if (input.checked) {
      // Неправильный выбранный ответ
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
  
  // Reset incorrect questions list
  incorrectQuestions = [];
  
  console.log("================================");
  console.log("НАЧИНАЕМ ПРОВЕРКУ РЕЗУЛЬТАТОВ ТЕСТА");
  console.log(`Всего вопросов: ${currentQuestions.length}, ответов: ${userAnswers.filter(a => a !== null).length}`);
  console.log("================================");
  
  // Отображаем все ответы пользователя для отладки
  userAnswers.forEach((answer, index) => {
    if (answer !== null) {
      console.log(`Ответ #${index+1}: "${answer}"`);
    }
  });
  
  // Check each question
  currentQuestions.forEach((q, i) => {
    const userAnswer = userAnswers[i];
    
    if (userAnswer !== null) {
      totalAnswered++;
      
      // Проверка правильного ответа
      const correctAnswer = q.answer;
      
      // Нормализуем строки для сравнения
      const normalizedUserAnswer = userAnswer.trim().toLowerCase();
      const normalizedCorrectAnswer = correctAnswer.trim().toLowerCase();
      
      console.log(`\nПРОВЕРКА ВОПРОСА #${i+1}: "${q.q.substring(0, 50)}..."`);
      console.log(`Ответ пользователя: "${userAnswer}"`);
      console.log(`Правильный ответ: "${correctAnswer}"`);
      
      // Проверка совпадения ответов разными способами
      let isCorrect = false;
      
      // Проверка 1: Простое сравнение - абсолютно одинаковые строки
      if (userAnswer === correctAnswer) {
        console.log("✓ Точное совпадение!");
        isCorrect = true;
      } else {
        // Проверка 2: Нормализованное сравнение
        if (normalizedUserAnswer === normalizedCorrectAnswer) {
          console.log("✓ Совпадение после нормализации!");
          isCorrect = true;
        }
        // Проверка 3: Включение одной строки в другую
        else if (normalizedUserAnswer.includes(normalizedCorrectAnswer)) {
          console.log("✓ Правильный ответ содержится в ответе пользователя!");
          isCorrect = true;
        }
        else if (normalizedCorrectAnswer.includes(normalizedUserAnswer)) {
          console.log("✓ Ответ пользователя содержится в правильном ответе!");
          isCorrect = true;
        }
        // Проверка 4: Совпадение первых слов для сложных ответов
        else if (normalizedUserAnswer.split(' ')[0] === normalizedCorrectAnswer.split(' ')[0] && 
                normalizedUserAnswer.length > 5 && normalizedCorrectAnswer.length > 5) {
          console.log("✓ Совпадение по первым словам!");
          isCorrect = true;
        }
        else {
          console.log("✗ Ответы не совпадают ни по одному из критериев");
        }
      }
      
      // Финальный результат для этого вопроса
      console.log(`Итоговая оценка: ${isCorrect ? 'ВЕРНО' : 'НЕВЕРНО'}`);
      
      if (isCorrect) {
        score++;
      } else {
        // Добавляем в список неправильных ответов
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
  
  // Отображаем результаты теста
  const resultsContainer = document.getElementById('results-container');
  const scoreFraction = document.getElementById('score-fraction');
  const scorePercentage = document.getElementById('score-percentage');
  const scoreProgress = document.getElementById('score-progress');
  
  // Посчитаем общее количество вопросов в тесте
  const totalQuestions = currentQuestions.length;
  
  // Calculate percentage out of total questions
  const percentage = totalAnswered > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  // Update result display with total questions
  scoreFraction.textContent = `${score} / ${totalQuestions}`;
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
  
  // Добавляем дополнительную информацию
  const resultDetails = document.getElementById('result-details');
  if (resultDetails) {
    // Если пользователь ответил не на все вопросы
    if (totalAnswered < totalQuestions) {
      resultDetails.textContent = `Вы ответили на ${totalAnswered} из ${totalQuestions} вопросов. Правильных ответов: ${score}.`;
    } else {
      resultDetails.textContent = `Правильных ответов: ${score} из ${totalQuestions}.`;
    }
  }
  
  // Display incorrect answers if any
  displayIncorrectAnswers();
  
  // Show results container
  resultsContainer.classList.remove('d-none');
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
  
  // Сообщаем об успешном завершении теста
  console.log(`Итоговая статистика: ${score} правильных из ${totalAnswered} отвеченных (${percentage}%)`);
  return score;
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
  
  // Проходим по списку вопросов и находим соответствующие неправильные ответы
  for (let i = 0; i < incorrectQuestions.length; i++) {
    const item = incorrectQuestions[i];
    const questionNumber = i + 1;
    
    // Ищем оригинальный вопрос среди всех вопросов текущего теста
    let originalQuestionIndex = -1;
    let originalQuestion = null;
    
    // Логгируем для отладки
    console.log(`Ищем оригинальный вопрос для: "${item.question}"`);
    
    for (let j = 0; j < currentQuestions.length; j++) {
      if (currentQuestions[j].q === item.question) {
        originalQuestionIndex = j;
        originalQuestion = currentQuestions[j];
        break;
      }
    }
    
    // Создаем элемент списка с информацией о неправильном ответе
    const listItem = document.createElement('div');
    listItem.className = 'list-group-item';
    
    // Формируем содержимое элемента
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
    
    // Отображаем правильный ответ из оригинального вопроса, если найден
    if (originalQuestion) {
      console.log(`Найден оригинальный вопрос: "${originalQuestion.q}" с правильным ответом: "${originalQuestion.answer}"`);
      content += `
        <small class="text-success">
          <i class="fas fa-check me-2"></i>
          Правильный ответ: ${originalQuestion.answer}
        </small>`;
    } else {
      // Если оригинальный вопрос не найден, используем сохраненный правильный ответ
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

// Функция для запуска режима прохождения всех тестов в категории
async function startAllCategoryTests() {
  try {
    // Показать индикатор загрузки
    document.getElementById('test-container').innerHTML = `
      <div class="text-center py-5">
        <span class="loader"></span>
        <p class="mt-3">Загрузка всех тестов категории...</p>
      </div>
    `;
    
    // Получить список всех тестов в категории
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
    
    // Инициализация переменных для загрузки всех вопросов
    let allQuestions = [];
    
    // Показать информацию о загрузке
    document.getElementById('test-info').innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        Загрузка всех вопросов из категории. Всего тестов: <strong>${allCategoryTests.length}</strong>
        <br>Загружено: <span id="loaded-tests-count">0</span> из ${allCategoryTests.length}
      </div>
    `;
    document.getElementById('test-info').classList.remove('d-none');
    
    // Загрузить все тесты параллельно
    const loadingPromises = [];
    let loadedCount = 0;
    
    for (const testFilename of allCategoryTests) {
      // Create loading promise
      const loadPromise = fetchTestFile(currentCategory, testFilename)
        .then(content => {
          // Получить вопросы из файла
          const questions = parseTest(content);
          
          // Добавить информацию об исходном тесте к каждому вопросу
          questions.forEach(q => {
            q.sourceTest = testFilename;
          });
          
          // Обновить счетчик загруженных тестов
          loadedCount++;
          document.getElementById('loaded-tests-count').textContent = loadedCount;
          
          return questions;
        })
        .catch(error => {
          console.error(`Error loading test ${testFilename}:`, error);
          return []; // Return empty array for failed tests
        });
      
      loadingPromises.push(loadPromise);
    }
    
    // Дождаться загрузки всех тестов
    const results = await Promise.all(loadingPromises);
    
    // Объединить все вопросы в один массив
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
    
    // Перемешиваем вопросы в случайном порядке
    allQuestions = shuffle(allQuestions);
    
    // Обновить текущие вопросы и начать тест
    currentQuestions = allQuestions;
    currentTestName = `Все вопросы из категории (${allQuestions.length} вопросов, случайный порядок)`;
    
    // Обновить информацию о тесте
    document.getElementById('test-info').innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        Загружено ${allQuestions.length} вопросов из ${allCategoryTests.length} тестов в случайном порядке.
      </div>
    `;
    
    // Начать тест со всеми вопросами
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    incorrectQuestions = [];
    
    // Отобразить вопросы
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

// Загрузка следующего теста в режиме всех тестов
// Функция для подготовки статистики по исходному тесту
function prepareTestSourceStats(allQuestions, userAnswers) {
  const testStats = {};
  
  // Подсчитать статистику по каждому исходному тесту
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
    
    // Если на вопрос был дан правильный ответ
    if (parseInt(userAnswers[i]) === question.correctIndex) {
      testStats[sourceTest].correct++;
    }
  }
  
  // Преобразовать в массив для вывода
  const testResults = Object.entries(testStats).map(([testName, stats]) => {
    return {
      testName,
      total: stats.total,
      correct: stats.correct
    };
  });
  
  return testResults;
}

// Функционал кнопки "Пройти все тесты категории" теперь интегрирован в финальную стадию теста через функцию prepareTestSourceStats

// Функция завершения теста с поддержкой статистики по исходным тестам
function finishTest() {
  // Вычислить результаты
  let score = 0;
  let totalAnswered = 0;
  incorrectQuestions = [];
  
  // Проверить каждый вопрос
  currentQuestions.forEach((q, i) => {
    const userAnswer = userAnswers[i];
    
    if (userAnswer) {
      totalAnswered++;
      // Получаем правильный индекс ответа для сравнения
      // Для совместимости с разными форматами тестов
      const correctAnswer = q.answer;
      let correctIndex = q.correctIndex;
      
      if (correctIndex === undefined) {
        // Если correctIndex не задан, используем позицию правильного ответа в массиве
        correctIndex = q.variants.indexOf(correctAnswer);
      }
      
      const isCorrect = parseInt(userAnswer) === correctIndex;
      
      if (isCorrect) {
        score++;
      } else {
        // Добавить в список неправильных ответов
        incorrectQuestions.push({
          question: q.q,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer
        });
      }
    }
  });
  
  // Показать результаты
  const resultsContainer = document.getElementById('results-container');
  const scoreFraction = document.getElementById('score-fraction');
  const scorePercentage = document.getElementById('score-percentage');
  const scoreProgress = document.getElementById('score-progress');
  
  // Рассчитать процент
  const percentage = totalAnswered > 0 ? Math.round((score / currentQuestions.length) * 100) : 0;
  
  // Обновить отображение результатов
  scoreFraction.textContent = `${score} / ${currentQuestions.length}`;
  scorePercentage.textContent = `${percentage}%`;
  scoreProgress.style.width = `${percentage}%`;
  
  // Установить цвет прогресс-бара в зависимости от результата
  if (percentage >= 80) {
    scoreProgress.className = 'progress-bar bg-success';
  } else if (percentage >= 60) {
    scoreProgress.className = 'progress-bar bg-warning';
  } else {
    scoreProgress.className = 'progress-bar bg-danger';
  }
  
  // Показать детальную статистику по исходным тестам, если это загрузка всех тестов
  const isAllTestsFromCategory = currentQuestions.some(q => q.sourceTest);
  
  if (isAllTestsFromCategory) {
    // Получить статистику по исходным тестам
    const testStats = prepareTestSourceStats(currentQuestions, userAnswers);
    
    // Отобразить статистику в отдельном разделе
    const container = document.getElementById('incorrect-answers-container');
    container.innerHTML = '';
    
    // Заголовок для статистики
    const statsHeader = document.createElement('h3');
    statsHeader.className = 'mt-4 mb-3';
    statsHeader.textContent = 'Статистика по тестам:';
    container.appendChild(statsHeader);
    
    // Таблица результатов
    const statsTable = document.createElement('table');
    statsTable.className = 'table table-striped';
    statsTable.innerHTML = `
      <thead>
        <tr>
          <th>№</th>
          <th>Тест</th>
          <th>Правильно/Всего</th>
          <th>Процент</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    
    // Заполнить таблицу
    const tbody = statsTable.querySelector('tbody');
    testStats.forEach((test, index) => {
      const percent = Math.round((test.correct / test.total) * 100) || 0;
      
      const row = document.createElement('tr');
      
      // Класс строки в зависимости от результата
      if (percent >= 80) {
        row.className = 'table-success';
      } else if (percent >= 60) {
        row.className = 'table-warning';
      } else {
        row.className = 'table-danger';
      }
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${test.testName}</td>
        <td>${test.correct}/${test.total}</td>
        <td>${percent}%</td>
      `;
      
      tbody.appendChild(row);
    });
    
    container.appendChild(statsTable);
  }
  
  // Отобразить неправильные ответы, если есть
  displayIncorrectAnswers();
  
  // Показать результаты
  resultsContainer.classList.remove('d-none');
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Legacy function - kept for compatibility
function checkAnswers(questions) {
  finishTest();
}
