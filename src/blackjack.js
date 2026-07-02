// Core Blackjack Game Logic

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
  { rank: 'A', value: 11 } // calculated dynamically
];

export class Card {
  constructor(suit, rankInfo) {
    this.suit = suit;
    this.rank = rankInfo.rank;
    this.value = rankInfo.value;
  }

  get countValue() {
    if (this.value >= 10 || this.rank === 'A') {
      return -1;
    } else if (this.value >= 2 && this.value <= 6) {
      return 1;
    }
    return 0; // 7, 8, 9
  }
}

export class Deck {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.cards = [];
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.reset();
  }

  reset() {
    this.cards = [];
    this.runningCount = 0;
    this.cardsDealt = 0;

    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of SUITS) {
        for (const rankInfo of RANKS) {
          this.cards.push(new Card(suit, rankInfo));
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.runningCount = 0;
    this.cardsDealt = 0;
  }

  draw() {
    if (this.cards.length === 0) {
      this.reset();
    }
    const card = this.cards.pop();
    this.cardsDealt++;
    this.runningCount += card.countValue;
    return card;
  }

  get cardsRemaining() {
    return this.cards.length;
  }

  get totalCards() {
    return this.numDecks * 52;
  }

  get penetrationPercent() {
    return Math.round((this.cardsDealt / this.totalCards) * 100);
  }

  get trueCount() {
    const decksRemaining = this.cardsRemaining / 52;
    if (decksRemaining < 0.25) return this.runningCount; // prevent division by very small numbers
    return Math.round((this.runningCount / decksRemaining) * 10) / 10;
  }
}

export class Hand {
  constructor(isDealer = false) {
    this.isDealer = isDealer;
    this.cards = [];
    this.status = 'playing'; // 'playing', 'stood', 'busted', 'blackjack', 'surrendered'
    this.bet = 0;
    this.isActive = false; // for player split hands tracking
  }

  addCard(card) {
    this.cards.push(card);
    const score = this.getScore();
    if (score > 21) {
      this.status = 'busted';
    } else if (score === 21 && this.cards.length === 2 && !this.isDealer) {
      // Blackjack only applies to initial 2 cards
      this.status = 'blackjack';
    }
  }

  getScore() {
    let score = 0;
    let aces = 0;

    for (const card of this.cards) {
      if (card.rank === 'A') {
        aces++;
        score += 11;
      } else {
        score += card.value;
      }
    }

    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return score;
  }

  isBusted() {
    return this.getScore() > 21;
  }

  isBlackjack() {
    return this.cards.length === 2 && this.getScore() === 21;
  }

  isSoft() {
    let score = 0;
    let aces = 0;

    for (const card of this.cards) {
      if (card.rank === 'A') {
        aces++;
        score += 11;
      } else {
        score += card.value;
      }
    }

    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return aces > 0 && score <= 21;
  }

  isPair() {
    if (this.cards.length !== 2) return false;
    // Standard blackjack allows splitting if ranks are equal or values are equal (like 10, J)
    // We will allow splitting if values are equal or ranks are equal.
    return this.cards[0].value === this.cards[1].value;
  }

  getCardValuesString() {
    return this.cards.map(c => c.rank).join(', ');
  }
}

// Basic Strategy engine (inputs: player's hand, dealer's upcard)
// Returns advice string: 'Hit', 'Stand', 'Double', or 'Split'
export function getBasicStrategyAdvice(playerHand, dealerUpCard) {
  if (!playerHand || playerHand.cards.length < 2 || !dealerUpCard) return '';

  const playerVal = playerHand.getScore();
  const dealerVal = dealerUpCard.value; // Ace is 11

  // 1. Pairs
  if (playerHand.isPair() && playerHand.cards.length === 2) {
    const cardRank = playerHand.cards[0].rank;
    const cardVal = playerHand.cards[0].value;

    if (cardRank === 'A' || cardVal === 8) {
      return 'Split'; // Always split Aces and 8s
    }
    if (cardVal === 10) {
      return 'Stand'; // Never split 10s
    }
    if (cardVal === 9) {
      // Split 9s vs dealer 2-9 except 7. Stand vs 7, 10, A.
      return (dealerVal >= 2 && dealerVal <= 9 && dealerVal !== 7) ? 'Split' : 'Stand';
    }
    if (cardVal === 7) {
      return (dealerVal >= 2 && dealerVal <= 7) ? 'Split' : 'Hit';
    }
    if (cardVal === 6) {
      return (dealerVal >= 2 && dealerVal <= 6) ? 'Split' : 'Hit';
    }
    if (cardVal === 5) {
      return (dealerVal >= 2 && dealerVal <= 9) ? 'Double' : 'Hit'; // Never split 5s, double instead if dealer 2-9
    }
    if (cardVal === 4) {
      return (dealerVal === 5 || dealerVal === 6) ? 'Split' : 'Hit';
    }
    if (cardVal === 3 || cardVal === 2) {
      return (dealerVal >= 2 && dealerVal <= 7) ? 'Split' : 'Hit';
    }
  }

  // 2. Soft Totals (A + something)
  if (playerHand.isSoft()) {
    // Find the non-Ace total
    const otherVal = playerVal - 11;

    if (otherVal >= 8) { // Soft 19 (A,8) or Soft 20 (A,9)
      return 'Stand';
    }
    if (otherVal === 7) { // Soft 18 (A,7)
      if (dealerVal >= 2 && dealerVal <= 6) return 'Double';
      if (dealerVal === 7 || dealerVal === 8) return 'Stand';
      return 'Hit';
    }
    if (otherVal === 6) { // Soft 17 (A,6)
      return (dealerVal >= 3 && dealerVal <= 6) ? 'Double' : 'Hit';
    }
    if (otherVal === 5 || otherVal === 4) { // Soft 16 (A,5), Soft 15 (A,4)
      return (dealerVal >= 4 && dealerVal <= 6) ? 'Double' : 'Hit';
    }
    if (otherVal === 3 || otherVal === 2) { // Soft 14 (A,3), Soft 13 (A,2)
      return (dealerVal === 5 || dealerVal === 6) ? 'Double' : 'Hit';
    }
  }

  // 3. Hard Totals
  if (playerVal >= 17) {
    return 'Stand';
  }
  if (playerVal === 16) {
    return (dealerVal >= 2 && dealerVal <= 6) ? 'Stand' : 'Hit';
  }
  if (playerVal === 15) {
    return (dealerVal >= 2 && dealerVal <= 6) ? 'Stand' : 'Hit';
  }
  if (playerVal === 14 || playerVal === 13 || playerVal === 12) {
    if (playerVal === 12 && (dealerVal === 2 || dealerVal === 3)) {
      return 'Hit';
    }
    return (dealerVal >= 2 && dealerVal <= 6) ? 'Stand' : 'Hit';
  }
  if (playerVal === 11) {
    return (dealerVal === 11) ? 'Hit' : 'Double'; // Double vs all except Ace
  }
  if (playerVal === 10) {
    return (dealerVal >= 2 && dealerVal <= 9) ? 'Double' : 'Hit';
  }
  if (playerVal === 9) {
    return (dealerVal >= 3 && dealerVal <= 6) ? 'Double' : 'Hit';
  }
  
  return 'Hit'; // 8 or less
}
