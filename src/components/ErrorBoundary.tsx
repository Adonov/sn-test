import { Component, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { reportError } from "../lib/errorReport";

function Crashed() {
  const { t } = useI18n();
  return (
    <div className="onboarding">
      <div className="onboarding-body welcome-hero">
        <h1>{t("crash.title")}</h1>
        <p className="muted">{t("crash.text")}</p>
      </div>
      <div className="onboarding-actions">
        <button className="btn primary wide" onClick={() => location.reload()}>
          {t("crash.reload")}
        </button>
      </div>
    </div>
  );
}

/** Instead of a blank screen after a rendering error: a message, a reload button and a report. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError("render", error);
  }

  render() {
    return this.state.failed ? <Crashed /> : this.props.children;
  }
}
