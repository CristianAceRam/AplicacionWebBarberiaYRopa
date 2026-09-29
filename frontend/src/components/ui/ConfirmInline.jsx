import CtaSecondary from '../CtaSecondary/CtaSecondary.jsx'
import styles from './ConfirmInline.module.css'

export default function ConfirmInline({
  msg,
  labelNo = 'No',
  labelSi,
  onNo,
  onSi,
  disabled = false,
  peligro = false,
}) {
  return (
    <div className={styles.panel}>
      <p className={styles.msg}>{msg}</p>
      <div className={styles.acciones}>
        <CtaSecondary size="sm" disabled={disabled} onClick={onNo}>
          {labelNo}
        </CtaSecondary>
        <CtaSecondary size="sm" danger={peligro} disabled={disabled} onClick={onSi}>
          {labelSi}
        </CtaSecondary>
      </div>
    </div>
  )
}
