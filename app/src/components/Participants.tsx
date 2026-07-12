type Participant = { identity: string; name: string };

type Props = {
  participants: Participant[];
  selfIdentity: string;
  isHost: boolean;
  onKick: (identity: string) => void;
  onBan: (identity: string) => void;
};

export function Participants({ participants, selfIdentity, isHost, onKick, onBan }: Props) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {participants.length === 0 && <div className="muted">視聴者はいません。</div>}
      {participants.map((p) => (
        <div key={p.identity} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{p.name || p.identity}</strong>
            {p.identity === selfIdentity ? <span style={{ marginLeft: 6, color: "#6b7280" }}>(自分)</span> : null}
          </div>
          {isHost && p.identity !== selfIdentity && (
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn" onClick={() => onKick(p.identity)}>
                キック
              </button>
              <button type="button" className="btn" onClick={() => onBan(p.identity)}>
                BAN+キック
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
