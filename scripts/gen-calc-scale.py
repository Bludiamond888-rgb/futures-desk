import re,sys
D=float(sys.argv[1]); p='src/index.css'; s=open(p).read()
i=s.index('/* ── Calculator: scale with available height')
s=s[:i]
def L(a,b):
    k=(b-a)/D
    return f"clamp({a}px, calc({round(a-660*k,2)}px + {round(k,5)} * var(--avail-h)), {b}px)"
s+=f"""/* ── Calculator: scale with available height (compact on ~660px viewports, roomier on tall phones) ── */
@media (max-width: 760px) {{
  /* Same fixed tab bar as every other tab. The page itself stays in normal flow and is exactly as tall as the
     space above the tab bar (--calc-h, measured in App.tsx), so there is nothing to scroll. */
  html.calc-lock {{ overscroll-behavior: none; }}
  .app.calc-lock {{ min-height: 0; height: var(--calc-h, calc(100dvh - 62px)); overflow: hidden;
    --avail-h: calc(var(--vp-h, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }}
  /* match the tab bar so no darker band can ever show below it */
  html.calc-lock, html.calc-lock body {{ background: #10161d; }}
  
  .app.calc-lock main {{ display: flex; flex-direction: column; padding-top: {L(8,16)}; padding-bottom: {L(8,16)}; }}
  .calc {{ flex: 1 0 auto; display: flex; flex-direction: column; }}
  .calc .calc-grid {{ flex: 1 0 auto; display: flex; flex-direction: column; align-items: stretch; gap: {L(8,14)}; }}
  .calc .result {{ flex: 1 0 auto; display: flex; flex-direction: column; justify-content: space-evenly; }}
  .calc .inputs {{ flex: 1.4 0 auto; justify-content: space-between; }}
  .calc .panel {{ padding: {L(10,16)} {L(12,16)}; }}
  .calc .field-label {{ font-size: {L(10.5,12.5)}; margin-bottom: {L(4,7)}; }}
  .calc .inputs .row2 {{ gap: {L(8,12)}; margin-top: {L(8,14)}; }}
  .calc #qty, .calc #tp, .calc #sl, .calc #entry, .calc .stepper button, .calc .seg {{ height: {L(42,56)}; }}
  .calc .picker-control {{ min-height: {L(42,56)}; }}
  .calc #qty, .calc #tp, .calc #sl, .calc #entry {{ font-size: {L(17,21)}; }}
  .calc .stepper {{ grid-template-columns: {L(40,52)} 1fr {L(40,52)}; }}
  .calc .seg button, .calc .picker-value {{ font-size: {L(14,16.5)}; }}
  .calc .picker-value .sym {{ font-size: {L(16,19)}; }}
  .calc .result-label {{ font-size: {L(12,14.5)}; }}
  .calc .tpsl {{ margin-top: {L(6,12)}; gap: {L(8,12)}; }}
  .calc .tpsl-box {{ padding: {L(8,14)} {L(10,14)}; gap: {L(1,4)}; }}
  .calc .tpsl-box span {{ font-size: {L(10.5,12.5)}; }}
  .calc .tpsl-box b {{ font-size: clamp(19px, min({L(22,34).replace('clamp(22px, ','').rsplit(', ',1)[0]}, 14cqi), 34px); white-space: nowrap; }}
  .calc .tpsl-box {{ container-type: inline-size; }}
  .calc .tpsl-box em, .calc .tpsl-box i {{ font-size: {L(12,15.5)}; }}
  .calc .lines {{ margin-top: {L(6,10)}; }}
  .calc .lines li {{ padding: {L(5,9)} 0; font-size: {L(12.5,14.5)}; }}
  .calc .rr-line span {{ font-size: {L(11,13)}; }}
  .calc .rr-line b {{ font-size: {L(17,21)}; }}
}}
"""
open(p,'w').write(s)
