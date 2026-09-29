/**
 * Own one connection attempt and its eventual room.
 *
 * LiveKit callbacks can arrive after a disconnect or a newer connection
 * attempt. The generation lease prevents stale rooms from changing current UI.
 */
export class RoomLease<TRoom> {
  private generation = 0;
  private active = false;
  private room: TRoom | null = null;

  begin(): number {
    if (this.active) throw new Error('A room connection cycle is already active');
    this.generation += 1;
    this.active = true;
    this.room = null;
    return this.generation;
  }

  attach(generation: number, room: TRoom): boolean {
    if (!this.isCurrentGeneration(generation) || this.room !== null) return false;
    this.room = room;
    return true;
  }

  isCurrent(generation: number, room: TRoom): boolean {
    return this.isCurrentGeneration(generation) && this.room === room;
  }

  isCurrentGeneration(generation: number): boolean {
    return this.active && this.generation === generation;
  }

  hasActiveCycle(): boolean {
    return this.active;
  }

  current(): TRoom | null {
    return this.room;
  }

  cancel(generation?: number): boolean {
    if (!this.active || (generation !== undefined && generation !== this.generation)) return false;
    this.room = null;
    this.active = false;
    this.generation += 1;
    return true;
  }

  release(room: TRoom): boolean {
    if (this.room !== room) return false;
    return this.cancel();
  }
}
