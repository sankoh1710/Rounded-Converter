const API_BASE = "https://api.frankfurter.dev/v2";

const fallbackCurrencies = {
  USD: "United States Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  TRY: "Turkish Lira",
  SAR: "Saudi Riyal",
  AED: "UAE Dirham",
  SLE: "Sierra Leonean Leone",
  NGN: "Nigerian Naira",
  GHS: "Ghanaian Cedi",
  JPY: "Japanese Yen",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
  CNY: "Chinese Yuan"
};

const amountInput = document.getElementById("amount");
const fromSelect = document.getElementById("fromCurrency");
const toSelect = document.getElementById("toCurrency");
const form = document.getElementById("converterForm");
const swapBtn = document.getElementById("swapBtn");
const convertBtn = document.getElementById("convertBtn");
const resultValue = document.getElementById("resultValue");
const resultExtra = document.getElementById("resultExtra");

function normalizeCurrencies(data) {
  if (Array.isArray(data)) {
    return data.reduce((list, item) => {
      if (item.code) list[item.code] = item.name || item.code;
      return list;
    }, {});
  }

  return Object.entries(data).reduce((list, [code, info]) => {
    if (typeof info === "string") {
      list[code] = info;
    } else {
      list[code] = info.name || info.label || code;
    }
    return list;
  }, {});
}

function populateCurrencySelects(currencies) {
  const sortedCurrencies = Object.entries(currencies).sort(([a], [b]) => a.localeCompare(b));

  fromSelect.innerHTML = "";
  toSelect.innerHTML = "";

  sortedCurrencies.forEach(([code, name]) => {
    const label = `${code} — ${name}`;

    const fromOption = new Option(label, code);
    const toOption = new Option(label, code);

    fromSelect.add(fromOption);
    toSelect.add(toOption);
  });

  fromSelect.value = currencies.USD ? "USD" : sortedCurrencies[0][0];
  toSelect.value = currencies.EUR ? "EUR" : sortedCurrencies[1][0];
}

async function loadCurrencies() {
  try {
    const response = await fetch(`${API_BASE}/currencies`);
    if (!response.ok) throw new Error("Could not load currencies.");

    const data = await response.json();
    const currencies = normalizeCurrencies(data);
    populateCurrencySelects(currencies);
  } catch (error) {
    populateCurrencySelects(fallbackCurrencies);
    resultExtra.textContent = "Currency list could not load, so the app used a small fallback list.";
  }
}

function setLoading(isLoading) {
  convertBtn.disabled = isLoading;
  convertBtn.textContent = isLoading ? "Converting..." : "Convert";
}

function showError(message) {
  resultValue.textContent = "—";
  resultExtra.innerHTML = `<span class="error">${message}</span>`;
}

function renderResultDetails(primaryText, detailText) {
  resultExtra.innerHTML = `
    <span class="result-exact">${primaryText}</span>
    <span class="result-detail">${detailText}</span>
  `;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(number);
}

async function convertCurrency() {
  const amount = Number(amountInput.value);
  const from = fromSelect.value;
  const to = toSelect.value;

  if (!amount || amount <= 0) {
    showError("Enter an amount greater than 0.");
    return;
  }

  if (from === to) {
    const roundedSameCurrency = Math.ceil(amount);
    resultValue.textContent = `${formatNumber(roundedSameCurrency)} ${to}`;
    renderResultDetails(
      `${amount} ${from} → ${roundedSameCurrency} ${to}`,
      `Rounded up to the next whole amount.`
    );
    return;
  }

  setLoading(true);
  resultValue.textContent = "—";
  renderResultDetails("Getting live exchange rate...", "Please wait while the conversion is prepared.");

  try {
    const response = await fetch(`${API_BASE}/rate/${from}/${to}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Conversion failed. Try another currency pair.");
    }

    const exactResult = amount * data.rate;
    const roundedResult = Math.ceil(exactResult);

    resultValue.textContent = `${formatNumber(roundedResult)} ${to}`;
    renderResultDetails(
      `Exact amount: ${amount} ${from} ≈ ${exactResult.toFixed(2)} ${to}`,
      `Rounded up from live rate ${data.rate}.`
    );
  } catch (error) {
    showError(error.message || "Something went wrong. Check your internet connection and try again.");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  convertCurrency();
});

swapBtn.addEventListener("click", function () {
  const oldFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = oldFrom;
  convertCurrency();
});

loadCurrencies().then(convertCurrency);
