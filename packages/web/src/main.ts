import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import { formatResultTable, parseRows } from '@wash-sale/adapters'

const screenDisclaimer = document.getElementById('screen-disclaimer')!
const screenInput = document.getElementById('screen-input')!
const screenOutput = document.getElementById('screen-output')!

const btnAgree = document.getElementById('btn-agree') as HTMLButtonElement
const countdownEl = document.getElementById('countdown')!

const tickerInput = document.getElementById('ticker') as HTMLInputElement
const csvTextarea = document.getElementById('csv') as HTMLTextAreaElement
const showAuditCheckbox = document.getElementById('show-audit') as HTMLInputElement
const btnCalculate = document.getElementById('btn-calculate')!

const outputError = document.getElementById('output-error')!
const outputPre = document.getElementById('output-pre')!
const btnCopy = document.getElementById('btn-copy')!
const btnStartOver = document.getElementById('btn-start-over')!

function showScreen(screen: HTMLElement): void {
  screenDisclaimer.classList.remove('active')
  screenInput.classList.remove('active')
  screenOutput.classList.remove('active')
  screen.classList.add('active')
}

// Screen 1: Disclaimer — 3-second countdown, then enable "I Agree"
const DELAY_MS = 3000
let countdownRemaining: number
let countdownInterval: ReturnType<typeof setInterval> | null = null

function startCountdown(): void {
  countdownRemaining = Math.ceil(DELAY_MS / 1000)
  countdownEl.textContent = `(${countdownRemaining}s)`

  countdownInterval = setInterval(() => {
    countdownRemaining--
    if (countdownRemaining <= 0) {
      if (countdownInterval) clearInterval(countdownInterval)
      countdownInterval = null
      btnAgree.disabled = false
      countdownEl.textContent = ''
    } else {
      countdownEl.textContent = `(${countdownRemaining}s)`
    }
  }, 1000)
}

startCountdown()

btnAgree.addEventListener('click', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  showScreen(screenInput)
})

// Screen 2: Input — Calculate
btnCalculate.addEventListener('click', () => {
  const ticker = tickerInput.value.trim()
  const csvText = csvTextarea.value.trim()

  showScreen(screenOutput)
  outputError.style.display = 'none'
  outputPre.style.display = 'none'

  if (!ticker) {
    showOutputError('Please enter a ticker symbol.')
    return
  }
  if (!csvText) {
    showOutputError('Please paste CSV data.')
    return
  }

  try {
    const rows = parseRows(csvText)
    const result = AdjustedCostBasisCalculator.forTicker(ticker).addRows(rows).calculate()

    const showAudit = showAuditCheckbox.checked
    const formatted = formatResultTable(result, { audit: showAudit })

    outputPre.textContent = formatted
    outputPre.style.display = 'block'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    showOutputError(message)
  }
})

function showOutputError(message: string): void {
  outputError.textContent = message
  outputError.style.display = 'block'
  outputPre.style.display = 'none'
}

// Screen 3: Output — Copy, Start Over
btnCopy.addEventListener('click', () => {
  const text = outputPre.textContent
  if (text) {
    void navigator.clipboard.writeText(text)
  }
})

btnStartOver.addEventListener('click', () => {
  showScreen(screenInput)
})
