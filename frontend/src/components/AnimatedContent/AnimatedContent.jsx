import styles from './AnimatedContent.module.css'

export default function AnimatedContent({ children }) {
  return <div className={styles.enter}>{children}</div>
}