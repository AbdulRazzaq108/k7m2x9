import { useState } from "react";
import { FlaskConical, Info, RotateCcw } from "lucide-react";

const example = { demand: "1000", wind: "300", secured: "400" };
const fields = [
  {
    key: "demand",
    label: "Forecast customer demand",
    hint: "Power your customers would need.",
  },
  {
    key: "wind",
    label: "Wind supply available to the utility",
    hint: "The utility’s own allocation of wind supply.",
  },
  {
    key: "secured",
    label: "Other supply already secured",
    hint: "Exclude the wind supply entered above.",
  },
] as const;
const format = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export default function ProcurementScenario() {
  const [inputs, setInputs] = useState(example);
  const values = fields.map(({ key }) =>
    inputs[key].trim() === "" ? NaN : Number(inputs[key]),
  );
  const validFields = values.map(
    (value) => Number.isFinite(value) && value >= 0,
  );
  const [demand, wind, secured] = values;
  const totalSupply = wind + secured;
  const valid = validFields.every(Boolean) && Number.isFinite(totalSupply);
  const additional = valid ? Math.max(0, demand - totalSupply) : null;
  const surplus = valid ? Math.max(0, totalSupply - demand) : 0;

  return (
    <section
      id="procurement"
      className="panel procurement-panel"
      aria-labelledby="procurement-heading"
    >
      <div className="panel-heading">
        <div>
          <div className="section-kicker">CONNECTING THE BUSINESS QUESTION</div>
          <h2 id="procurement-heading">Illustrative procurement scenario</h2>
          <p>
            Explore how demand and available supply determine the remaining
            power requirement.
          </p>
        </div>
        <span className="scenario-badge">
          <FlaskConical size={14} />
          Illustration only
        </span>
      </div>

      <div className="scenario-disclosure" id="scenario-context">
        <Info size={16} />
        <p>
          All inputs are <strong>hypothetical and editable</strong>. Enter
          values for the same utility and the same delivery period, in MW.
          National Elexon wind generation is not the utility’s available wind
          supply. This illustration is independent of the selected date and
          forecast-accuracy results.
        </p>
      </div>

      <form
        className="scenario-form"
        aria-describedby="scenario-context"
        onSubmit={(event) => event.preventDefault()}
        noValidate
      >
        <div className="scenario-inputs">
          {fields.map(({ key, label, hint }, index) => (
            <div className="scenario-field" key={key}>
              <label htmlFor={`scenario-${key}`}>{label}</label>
              <div
                className={`scenario-input-wrap ${validFields[index] ? "" : "invalid"}`}
              >
                <input
                  id={`scenario-${key}`}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  required
                  value={inputs[key]}
                  onChange={(event) =>
                    setInputs((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  aria-invalid={!validFields[index]}
                  aria-describedby={`scenario-${key}-hint${validFields[index] ? "" : ` scenario-${key}-error`}`}
                />
                <span aria-hidden="true">MW</span>
              </div>
              <p id={`scenario-${key}-hint`} className="scenario-hint">
                {hint}
              </p>
              {!validFields[index] && (
                <p
                  id={`scenario-${key}-error`}
                  className="scenario-field-error"
                >
                  Enter a non-negative number.
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="scenario-actions">
          <span>
            Example inputs only · no demand or utility portfolio dataset is
            loaded
          </span>
          <button type="button" onClick={() => setInputs(example)}>
            <RotateCcw size={13} />
            Reset example
          </button>
        </div>
      </form>

      <div
        className="scenario-result"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <span className="scenario-result-label">
            ADDITIONAL POWER REQUIRED
          </span>
          <div className="scenario-quantity">
            <output
              id="procurement-result"
              htmlFor="scenario-demand scenario-wind scenario-secured"
            >
              {additional === null ? "—" : format.format(additional)}
            </output>
            <span>MW</span>
          </div>
          <p>
            {!valid
              ? "Complete all three inputs with non-negative numbers to calculate a result."
              : surplus > 0
                ? `No additional power required. Illustrative surplus: ${format.format(surplus)} MW.`
                : additional === 0
                  ? "Available supply matches the illustrative demand."
                  : `Illustrative supply covers ${format.format(totalSupply)} MW of ${format.format(demand)} MW demand.`}
          </p>
        </div>
        <div className="scenario-formula">
          <span>HOW IT IS CALCULATED</span>
          <p>
            max(0, customer demand − utility wind supply − other secured supply)
          </p>
          <small>
            Results use your manual inputs and do not estimate the utility’s
            actual purchases.
          </small>
        </div>
      </div>
    </section>
  );
}
