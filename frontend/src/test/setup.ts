import '@testing-library/jest-dom/vitest'

// jsdom has no localStorage quota issues, but tests should not leak a session
// from one case into the next.
afterEach(() => {
  window.localStorage.clear()
})
