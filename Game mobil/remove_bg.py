from PIL import Image
import numpy as np
from collections import deque

def remove_bg_floodfill(input_path, output_path, tolerance=30):
    """
    Hapus background dengan flood fill dari ke-4 sudut gambar.
    Lebih akurat dibanding threshold biasa - hanya hapus warna yang
    terhubung langsung dengan tepi gambar.
    """
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]

    # Ambil warna background dari pojok kiri atas
    bg_color = data[0, 0, :3].astype(int)

    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Mulai dari keempat sudut + seluruh tepi gambar
    for y in range(h):
        for x in [0, w-1]:
            if not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True
    for x in range(w):
        for y in [0, h-1]:
            if not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True

    # Flood fill - BFS
    while queue:
        y, x = queue.popleft()
        pixel = data[y, x, :3].astype(int)
        diff = np.abs(pixel - bg_color).max()

        if diff <= tolerance:
            # Buat transparan
            data[y, x, 3] = 0

            # Cek 4 tetangga
            for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
                ny, nx = y+dy, x+dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))

    result = Image.fromarray(data, "RGBA")
    result.save(output_path, "PNG")
    print(f"Saved: {output_path}")

remove_bg_floodfill("Asset/Pohon1.jpeg", "Asset/Pohon1.png", tolerance=35)
remove_bg_floodfill("Asset/Pohon2.jpeg", "Asset/Pohon2.png", tolerance=35)
print("Selesai! Background putih dihapus sepenuhnya.")
