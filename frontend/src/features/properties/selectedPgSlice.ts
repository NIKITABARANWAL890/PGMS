import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * Which PG the header switcher is pointed at.
 *
 * This lives in global state rather than in the header component because
 * several unrelated features need to read it — the dashboard, the Rooms & Beds
 * screen, and (from Phase 2 on) tenants and billing. `null` means the owner's
 * "All PGs" view.
 */
interface SelectedPgState {
  selectedPgId: string | null
}

const initialState: SelectedPgState = { selectedPgId: null }

const selectedPgSlice = createSlice({
  name: 'selectedPg',
  initialState,
  reducers: {
    pgSelected(state, action: PayloadAction<string | null>) {
      state.selectedPgId = action.payload
    },
  },
})

export const { pgSelected } = selectedPgSlice.actions
export default selectedPgSlice.reducer
