// 전역 키보드 악기 입력(드럼패드·키보드)이 폼 입력·단축키를 가로채지 않기 위한 공용 가드.

/** 텍스트 입력·선택 UI에 포커스가 있으면 true — 악기 핫키를 무시해야 한다 */
export function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

/** Ctrl/Meta/Alt 조합은 표준 단축키(복사·붙여넣기·undo 등) — 악기 발음 금지 */
export function hasModifier(e: KeyboardEvent): boolean {
	return e.ctrlKey || e.metaKey || e.altKey;
}
