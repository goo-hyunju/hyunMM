"""모델 체크포인트 로드/언로드, VRAM 관리.

체크포인트는 service/checkpoints/ (gitignore 대상)에 둔다.
"""


class ModelManager:
    def load(self, model_id: str) -> None:
        raise NotImplementedError

    def unload(self, model_id: str) -> None:
        raise NotImplementedError
