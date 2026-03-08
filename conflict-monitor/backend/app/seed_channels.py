# Channel metadata: username -> (display_name, reliability 1-5)
# 5 = institutional/verified, 4 = consistently accurate, 3 = decent but unverified,
# 2 = mixed accuracy, 1 = high volume but noisy
CHANNEL_METADATA: dict[str, tuple[str, int]] = {
    "Middle_East_Spectator": ("Middle East Spectator", 4),
    "inabornintel": ("Aurora Intel", 5),
    "SentDefender": ("Sentdefender", 4),
    "OSINTdefender": ("OSINT Defender", 4),
    "IntelSlava": ("Intel Slava Z", 2),
    "CIG_telegram": ("Conflict Intelligence Group", 4),
    "IsraelRadar_com": ("Israel Radar", 3),
    "MilitaryOSINT": ("Military OSINT", 3),
    "IranIntl_En": ("Iran International English", 4),
    "AuroraIntel": ("Aurora Intel (alt)", 5),
}

DEFAULT_CHANNELS = list(CHANNEL_METADATA.keys())


def get_reliability(channel_name: str) -> int | None:
    """Look up reliability score for a channel username."""
    meta = CHANNEL_METADATA.get(channel_name)
    return meta[1] if meta else None
