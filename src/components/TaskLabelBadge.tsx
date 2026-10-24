import type { TaskLabel } from '../game';
import './TaskLabelBadge.css';

export default function TaskLabelBadge({ labelId, labels }: { labelId?: string; labels?: TaskLabel[] }) {
  const label = labels?.find((item) => item.id === labelId);
  return label ? <span className="task-label-badge">{label.name}</span> : null;
}
