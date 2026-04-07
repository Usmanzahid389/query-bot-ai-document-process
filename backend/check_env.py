import os

from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    key = os.getenv("LLM_API_KEY")
    if not key:
        print("API Key loaded?: No (LLM_API_KEY is missing)")
        return
    print(f"API Key loaded?: Yes ({key[:10]}...)")


if __name__ == "__main__":
    main()
