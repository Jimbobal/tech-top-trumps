import { statLabels, techTitansDeck, type StatKey, type TitanCardData } from "@/lib/techTitansDeck";

export type PlayerId = "p1" | "p2";

export type RoundResult = {
  title: string;
  body: string;
  tone: "neutral" | "win" | "draw";
};

export type GameState = {
  p1Deck: string[];
  p2Deck: string[];
  pendingPot: string[];
  activePlayer: PlayerId;
  selectedStat: StatKey | null;
  revealed: boolean;
  roundResult: RoundResult;
  updatedAt: number;
};

export const cardsById = new Map(techTitansDeck.map((card) => [card.id, card]));

export function cardFromId(id?: string): TitanCardData | undefined {
  return id ? cardsById.get(id) : undefined;
}

export function playerName(player: PlayerId) {
  return player === "p1" ? "Player 1" : "Player 2";
}

export function shuffleDeck(cards: TitanCardData[]) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createGameState(): GameState {
  const shuffled = shuffleDeck(techTitansDeck).map((card) => card.id);
  return {
    p1Deck: shuffled.slice(0, 12),
    p2Deck: shuffled.slice(12),
    pendingPot: [],
    activePlayer: "p1",
    selectedStat: null,
    revealed: false,
    roundResult: {
      title: "Choose the opening category",
      body: "Player 1 leads. In online mode, each player sees their own card.",
      tone: "neutral",
    },
    updatedAt: Date.now(),
  };
}

export function getWinner(state: GameState): PlayerId | null {
  if (state.p1Deck.length === 24 || state.p2Deck.length === 0) return "p1";
  if (state.p2Deck.length === 24 || state.p1Deck.length === 0) return "p2";
  return null;
}

export function isGameOver(state: GameState) {
  return Boolean(getWinner(state));
}

export function chooseStatForState(state: GameState, stat: StatKey): GameState {
  if (state.selectedStat || isGameOver(state)) return state;

  const p1Card = cardFromId(state.p1Deck[0]);
  const p2Card = cardFromId(state.p2Deck[0]);
  if (!p1Card || !p2Card) return state;

  const activeCard = state.activePlayer === "p1" ? p1Card : p2Card;
  const defendingCard = state.activePlayer === "p1" ? p2Card : p1Card;
  const defendingPlayer: PlayerId = state.activePlayer === "p1" ? "p2" : "p1";
  const activeScore = activeCard.stats[stat];
  const defendingScore = defendingCard.stats[stat];
  const potCards = [...state.pendingPot, p1Card.id, p2Card.id];
  const nextP1Deck = state.p1Deck.slice(1);
  const nextP2Deck = state.p2Deck.slice(1);

  if (activeScore === defendingScore) {
    if (nextP1Deck.length === 0 && nextP2Deck.length === 0) {
      const reshuffledPot = shuffleDeck(potCards.map((id) => cardFromId(id)).filter(Boolean) as TitanCardData[]).map((card) => card.id);
      return {
        ...state,
        p1Deck: reshuffledPot.slice(0, Math.ceil(reshuffledPot.length / 2)),
        p2Deck: reshuffledPot.slice(Math.ceil(reshuffledPot.length / 2)),
        pendingPot: [],
        selectedStat: stat,
        revealed: true,
        roundResult: {
          title: `${statLabels[stat]} is tied at ${activeScore}`,
          body: "Final-card draw. The pot has been reshuffled and split for sudden death.",
          tone: "draw",
        },
        updatedAt: Date.now(),
      };
    }

    if (nextP1Deck.length === 0) {
      return {
        ...state,
        p1Deck: [],
        p2Deck: [...nextP2Deck, ...potCards],
        pendingPot: [],
        selectedStat: stat,
        revealed: true,
        roundResult: {
          title: "Player 2 captures the final pot",
          body: `${statLabels[stat]} tied, but Player 1 has no cards left to continue.`,
          tone: "win",
        },
        updatedAt: Date.now(),
      };
    }

    if (nextP2Deck.length === 0) {
      return {
        ...state,
        p1Deck: [...nextP1Deck, ...potCards],
        p2Deck: [],
        pendingPot: [],
        selectedStat: stat,
        revealed: true,
        roundResult: {
          title: "Player 1 captures the final pot",
          body: `${statLabels[stat]} tied, but Player 2 has no cards left to continue.`,
          tone: "win",
        },
        updatedAt: Date.now(),
      };
    }

    return {
      ...state,
      p1Deck: nextP1Deck,
      p2Deck: nextP2Deck,
      pendingPot: potCards,
      selectedStat: stat,
      revealed: true,
      roundResult: {
        title: `${statLabels[stat]} is tied at ${activeScore}`,
        body: `${potCards.length} cards are now in the pending pot. ${playerName(state.activePlayer)} chooses again.`,
        tone: "draw",
      },
      updatedAt: Date.now(),
    };
  }

  const winningPlayer: PlayerId = activeScore > defendingScore ? state.activePlayer : defendingPlayer;

  return {
    ...state,
    p1Deck: winningPlayer === "p1" ? [...nextP1Deck, ...potCards] : nextP1Deck,
    p2Deck: winningPlayer === "p2" ? [...nextP2Deck, ...potCards] : nextP2Deck,
    pendingPot: [],
    activePlayer: winningPlayer,
    selectedStat: stat,
    revealed: true,
    roundResult: {
      title: `${playerName(winningPlayer)} wins ${potCards.length} card${potCards.length === 1 ? "" : "s"}`,
      body: `${activeCard.name} scored ${activeScore} vs ${defendingCard.name} on ${statLabels[stat]} with ${defendingScore}.`,
      tone: "win",
    },
    updatedAt: Date.now(),
  };
}

export function continueState(state: GameState): GameState {
  return {
    ...state,
    selectedStat: null,
    revealed: false,
    updatedAt: Date.now(),
  };
}
