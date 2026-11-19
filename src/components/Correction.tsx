/** 원본 / 첨삭본 나란히 */
export default function Correction({
  original,
  corrected,
  photoUrl,
  markupUrl,
}: {
  original: string | null;
  corrected: string | null;
  photoUrl: string | null;
  markupUrl: string | null;
}) {
  return (
    <div className="grid2">
      <div className="card col">
        <div className="label">내가 쓴 원본</div>
        {photoUrl && <div className="photo"><img src={photoUrl} alt="원본 사진" /></div>}
        {original && <div className="paper en">{original}</div>}
      </div>
      <div className="card strong col">
        <div className="label" style={{ color: "var(--navy)" }}>쌤 첨삭본</div>
        {photoUrl && markupUrl && (
          <div className="photo">
            <img src={photoUrl} alt="" />
            <img className="overlay" src={markupUrl} alt="쌤 첨삭" />
          </div>
        )}
        {corrected && <div className="paper en">{corrected}</div>}
        {!corrected && !markupUrl && <div className="muted">사진 위에 첨삭했어요.</div>}
      </div>
    </div>
  );
}
