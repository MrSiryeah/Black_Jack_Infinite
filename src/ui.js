// UI rendering helpers for Blackjack Infinite

// Map suit strings to standard symbols
const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

// Create a card DOM element
export function createCardElement(card, isFaceDown = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `card-wrapper dealt ${isFaceDown ? 'face-down' : ''}`;

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Front Face
  const front = document.createElement('div');
  front.className = `card-face card-front ${card.suit}`;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';

  // Top left corner
  const cornerTop = document.createElement('div');
  cornerTop.className = 'card-corner top';
  cornerTop.innerHTML = `
    <span class="card-corner-rank">${card.rank}</span>
    <span class="card-corner-suit">${suitSymbol}</span>
  `;

  // Center symbol
  const centerSuit = document.createElement('div');
  centerSuit.className = 'card-center-suit';
  centerSuit.textContent = suitSymbol;

  // Bottom right corner
  const cornerBottom = document.createElement('div');
  cornerBottom.className = 'card-corner bottom';
  cornerBottom.innerHTML = `
    <span class="card-corner-rank">${card.rank}</span>
    <span class="card-corner-suit">${suitSymbol}</span>
  `;

  front.appendChild(cornerTop);
  front.appendChild(centerSuit);
  front.appendChild(cornerBottom);

  // Back Face
  const back = document.createElement('div');
  back.className = 'card-face card-back';

  inner.appendChild(front);
  inner.appendChild(back);
  wrapper.appendChild(inner);

  return wrapper;
}

// Render cards and details into a hand slot
export function renderHand(container, hand, options = {}) {
  const { 
    showScore = true, 
    hideFirstCard = false, 
    isActive = false, 
    result = null, // 'win', 'lose', 'push', 'blackjack', 'bust'
    isSplit = false 
  } = options;

  container.innerHTML = '';
  
  // Set active/inactive states for split hands
  const handSlot = container.closest('.hand-slot');
  if (handSlot) {
    if (isActive) {
      handSlot.className = 'hand-slot active';
    } else {
      handSlot.className = isSplit ? 'hand-slot inactive' : 'hand-slot';
    }
  }

  // Create cards container
  const cardsDiv = document.createElement('div');
  cardsDiv.className = 'cards-container';

  hand.cards.forEach((card, idx) => {
    const faceDown = hideFirstCard && idx === 0;
    const cardEl = createCardElement(card, faceDown);
    cardsDiv.appendChild(cardEl);
  });
  container.appendChild(cardsDiv);

  // Score Badge
  if (showScore && hand.cards.length > 0) {
    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'hand-score-badge';
    
    if (hideFirstCard) {
      // Calculate only visible card values
      if (hand.cards.length > 1) {
        const visibleScore = hand.cards[1].rank === 'A' ? 11 : hand.cards[1].value;
        scoreBadge.textContent = visibleScore;
      } else {
        scoreBadge.textContent = '?';
      }
    } else {
      scoreBadge.textContent = hand.getScore();
    }
    container.appendChild(scoreBadge);
  }

  // Bet Badge
  if (hand.bet > 0) {
    const betBadge = document.createElement('div');
    betBadge.className = 'hand-bet-badge';
    betBadge.textContent = `$${hand.bet}`;
    container.appendChild(betBadge);
  }

  // Result Badge (e.g. Win, Bust)
  if (result) {
    const resultBadge = document.createElement('div');
    resultBadge.className = `hand-result-badge ${result}`;
    
    let text = result.toUpperCase();
    if (result === 'blackjack') text = 'BLACKJACK';
    if (result === 'push') text = 'PUSH / TIE';
    
    resultBadge.textContent = text;
    container.appendChild(resultBadge);
  }
}

// Render dynamic split hands in the DOM
export function recreatePlayerHandSlots(container, hands, activeIndex, results = []) {
  container.innerHTML = '';

  const isSplit = hands.length > 1;

  hands.forEach((hand, idx) => {
    const handSlot = document.createElement('div');
    handSlot.className = `hand-slot ${activeIndex === idx ? 'active' : (isSplit ? 'inactive' : '')}`;
    handSlot.id = `hand-slot-${idx}`;

    const header = document.createElement('div');
    header.className = 'hand-header';

    const label = document.createElement('span');
    label.className = 'hand-label';
    label.textContent = isSplit ? `HAND ${idx + 1}` : 'YOUR HAND';

    header.appendChild(label);
    handSlot.appendChild(header);

    // Create cards container inside the hand slot
    const handCards = document.createElement('div');
    handCards.className = 'hand-cards-wrapper';
    handSlot.appendChild(handCards);

    container.appendChild(handSlot);

    // Call renderHand on the slot's cards wrapper
    renderHand(handCards, hand, {
      showScore: true,
      hideFirstCard: false,
      isActive: activeIndex === idx,
      result: results[idx] || (hand.isBusted() ? 'bust' : null),
      isSplit: isSplit
    });
  });
}

// Format numbers as currency
export function formatCurrency(amount) {
  return '$' + Number(amount).toLocaleString();
}

// Show/Hide overlays
export function showStatusMessage(element, text) {
  element.textContent = text;
  element.classList.remove('hidden');
}

export function hideStatusMessage(element) {
  element.classList.add('hidden');
}
