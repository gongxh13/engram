export interface SessionSignals {
  turn_count: number;
  user_edits: number;
  time_to_accept?: number;
  tool_calls?: number;
}

export class SignalAccumulator {
  private turnCount = 0;
  private userEdits = 0;
  private toolCalls = 0;
  private startTime?: number;

  start(): void {
    this.startTime = Date.now();
  }

  addTurn(): void {
    this.turnCount++;
  }

  addUserEdit(count = 1): void {
    this.userEdits += count;
  }

  addToolCall(count = 1): void {
    this.toolCalls += count;
  }

  getSignals(): SessionSignals {
    const signals: SessionSignals = {
      turn_count: this.turnCount,
      user_edits: this.userEdits,
      tool_calls: this.toolCalls,
    };

    if (this.startTime) {
      signals.time_to_accept = (Date.now() - this.startTime) / 1000;
    }

    return signals;
  }

  reset(): void {
    this.turnCount = 0;
    this.userEdits = 0;
    this.toolCalls = 0;
    this.startTime = undefined;
  }
}
