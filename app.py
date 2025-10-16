from flask import Flask, render_template, request, jsonify, make_response
import sqlite3
import datetime
import pdfkit
import os
import threading
import webbrowser
import sys
import pathlib
import re

# wkhtmltopdf yolunu otomatik tespit eden yardımcı
def _detect_wkhtmltopdf_path():
    """wkhtmltopdf.exe için en uygun yolu bulur.

    Arama önceliği:
    1) Ortam değişkeni: WKHTMLTOPDF_PATH
    2) PyInstaller bundle klasörü (sys._MEIPASS)
    3) Uygulama dizininde gömülü: ./bin/wkhtmltopdf.exe veya ./wkhtmltopdf/bin/wkhtmltopdf.exe
    4) Varsayılan kurulum: C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe
    """
    candidate_paths = []

    # 1) Ortam değişkeni
    env_path = os.environ.get('WKHTMLTOPDF_PATH')
    if env_path:
        candidate_paths.append(env_path)

    # 2) PyInstaller geçici klasörü
    base_dir_candidates = []
    if hasattr(sys, '_MEIPASS'):
        base_dir_candidates.append(getattr(sys, '_MEIPASS'))
    # 3) Uygulama dizini
    base_dir_candidates.append(os.path.dirname(os.path.abspath(__file__)))

    for base_dir in base_dir_candidates:
        candidate_paths.append(os.path.join(base_dir, 'bin', 'wkhtmltopdf.exe'))
        candidate_paths.append(os.path.join(base_dir, 'wkhtmltopdf', 'bin', 'wkhtmltopdf.exe'))

    # 4) Program Files varsayılanı
    candidate_paths.append(r'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe')

    for path in candidate_paths:
        if path and os.path.isfile(path):
            return path

    # Son çare: None döndür (pdf oluşturma denemesi error handling ile yakalanır)
    return None

# pdfkit configuration: tespit edilen yol ile oluştur
_wk_path = _detect_wkhtmltopdf_path()
config = pdfkit.configuration(wkhtmltopdf=_wk_path) if _wk_path else None

app = Flask(__name__)

# Veritabanı yolu - kalıcı konum
def get_database_path():
    """Veritabanının kalıcı konumunu döndürür."""
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller exe çalışıyor - kullanıcı belgeleri klasöründe sakla
        import winreg
        
        # Önce exe'nin yanındaki klasörde veritabanı var mı kontrol et
        exe_dir = os.path.dirname(sys.executable)
        local_db_path = os.path.join(exe_dir, 'Bosch Service', 'parca_veri.db')
        if os.path.exists(local_db_path):
            print(f"Yerel veritabanı bulundu: {local_db_path}")
            return local_db_path
        
        # Yerel yoksa Belgeler klasörünü dene
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                               r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders") as key:
                documents_path = winreg.QueryValueEx(key, "Personal")[0]
        except:
            # Fallback: kullanıcı masaüstü
            documents_path = os.path.expanduser("~/Desktop")
        
        # Önce Belgeler klasörünü dene
        try:
            db_dir = os.path.join(documents_path, "Bosch Service")
            os.makedirs(db_dir, exist_ok=True)
            test_path = os.path.join(db_dir, 'test.txt')
            with open(test_path, 'w') as f:
                f.write('test')
            os.remove(test_path)
            return os.path.join(db_dir, 'parca_veri.db')
        except:
            # Belgeler klasöründe yazma izni yoksa masaüstünü dene
            try:
                desktop_path = os.path.expanduser("~/Desktop")
                db_dir = os.path.join(desktop_path, "Bosch Service")
                os.makedirs(db_dir, exist_ok=True)
                return os.path.join(db_dir, 'parca_veri.db')
            except:
                # Son çare: exe'nin bulunduğu klasör
                exe_dir = os.path.dirname(sys.executable)
                db_dir = os.path.join(exe_dir, 'Bosch Service')
                os.makedirs(db_dir, exist_ok=True)
                return os.path.join(db_dir, 'parca_veri.db')
    else:
        # Normal Python çalışıyor - mevcut dizinde
        return 'parca_veri.db'

# Veritabanı adı - dinamik olarak al
DB_NAME = get_database_path()

def get_db_connection():
    """Veritabanı bağlantısını döndürür."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_database_ready():
    """Veritabanı yoksa oluşturur, tablo boşsa populate eder."""
    try:
        print(f"Veritabanı hazırlanıyor...")
        print(f"Hedef veritabanı yolu: {DB_NAME}")
        print(f"PyInstaller modu: {hasattr(sys, '_MEIPASS')}")
        
        db_exists = os.path.exists(DB_NAME)
        print(f"Veritabanı mevcut mu: {db_exists}")
        
        if not db_exists:
            print("Veritabanı bulunamadı, oluşturuluyor...")
            # Veritabanı yoksa, mevcut veritabanından kopyala veya yeni oluştur
            if hasattr(sys, '_MEIPASS'):
                # PyInstaller exe çalışıyor - gömülü veritabanından kopyala
                embedded_db = os.path.join(sys._MEIPASS, 'parca_veri.db')
                print(f"Gömülü veritabanı yolu: {embedded_db}")
                print(f"Gömülü veritabanı mevcut mu: {os.path.exists(embedded_db)}")
                
                if os.path.exists(embedded_db):
                    import shutil
                    try:
                        # Hedef klasörü oluştur
                        db_dir = os.path.dirname(DB_NAME)
                        os.makedirs(db_dir, exist_ok=True)
                        print(f"Hedef klasör oluşturuldu: {db_dir}")
                        
                        # Veritabanını kopyala
                        shutil.copy2(embedded_db, DB_NAME)
                        print(f"Veritabanı başarıyla kopyalandı: {DB_NAME}")
                    except Exception as copy_error:
                        print(f"Veritabanı kopyalama hatası: {copy_error}")
                        # Fallback: yeni oluştur
                        from create_db import create_and_populate_db
                        create_and_populate_db()
                else:
                    print("Gömülü veritabanı bulunamadı, yeni oluşturuluyor...")
                    # Gömülü veritabanı yoksa yeni oluştur
                    from create_db import create_and_populate_db
                    create_and_populate_db()
            else:
                print("Normal Python modu, yeni veritabanı oluşturuluyor...")
                # Normal Python çalışıyor
                from create_db import create_and_populate_db
                create_and_populate_db()
            return

        # DB var; tablo ve veri kontrolü yap
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT name FROM sqlite_master WHERE type='table' AND name='parts'
        """)
        table_exists = cur.fetchone() is not None
        if not table_exists:
            conn.close()
            from create_db import create_and_populate_db
            create_and_populate_db()
            return

        cur.execute("SELECT COUNT(1) FROM parts")
        count = cur.fetchone()[0]
        conn.close()
        if count == 0:
            # Tablo boşsa, gömülü veritabanından veri kopyala
            if hasattr(sys, '_MEIPASS'):
                embedded_db = os.path.join(sys._MEIPASS, 'parca_veri.db')
                if os.path.exists(embedded_db):
                    import shutil
                    shutil.copy2(embedded_db, DB_NAME)
                    print(f"Veritabanı verileri kopyalandı: {DB_NAME}")
                else:
                    from create_db import create_and_populate_db
                    create_and_populate_db()
            else:
                from create_db import create_and_populate_db
                create_and_populate_db()
    except Exception as e:
        # Sessizce geç; uygulama en azından çalışsın
        print(f"Veritabanı hazırlama hatası: {e}")

# Ana sayfa yönlendirmesi
@app.route('/')
def index():
    return render_template('index.html')

# Veritabanı bilgisi endpoint'i
@app.route('/api/db_info')
def db_info():
    return jsonify({
        "location": DB_NAME,
        "is_persistent": hasattr(sys, '_MEIPASS')
    })

# Veritabanı arama endpoint'i
@app.route('/api/search_parts', methods=['GET'])
def search_parts():
    query = request.args.get('query', '').strip()
    print(f"Arama sorgusu: '{query}'")
    
    if not query:
        print("Boş sorgu, boş sonuç döndürülüyor")
        return jsonify([])

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Veritabanındaki tablo sayısını kontrol et
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Mevcut tablolar: {[table[0] for table in tables]}")
        
        # parts tablosundaki kayıt sayısını kontrol et
        cursor.execute("SELECT COUNT(*) FROM parts")
        count = cursor.fetchone()[0]
        print(f"Parts tablosundaki kayıt sayısı: {count}")
        
        # Değiştirilmiş arama sorgusu:
        # `part_code` için yalnızca başlangıç eşleşmesi (`LIKE ?`)
        # `part_name` içinse kelimenin herhangi bir yerinde geçmesi için (`LIKE ?`)
        search_query = '''
            SELECT part_code, part_name, price_eur FROM parts 
            WHERE part_code LIKE ? OR part_name LIKE ?
        '''
        search_params = (f'{query}%', f'%{query}%')
        
        print(f"SQL sorgusu: {search_query}")
        print(f"Parametreler: {search_params}")
        
        cursor.execute(search_query, search_params)
        results = cursor.fetchall()
        print(f"Bulunan sonuç sayısı: {len(results)}")
        
        conn.close()

        processed_results = []
        for row in results:
            part = dict(row)
            processed_results.append(part)

        print(f"İşlenmiş sonuçlar: {processed_results}")
        return jsonify(processed_results)
        
    except Exception as e:
        print(f"Arama hatası: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Yeni parça ekleme endpoint'i
@app.route('/api/add_part', methods=['POST'])
def add_part():
    data = request.json
    
    # Gerekli alanları kontrol et
    required_fields = ['part_code', 'part_name', 'category']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} alanı gereklidir"}), 400
    
    part_code = data.get('part_code').strip()
    part_name = data.get('part_name').strip()
    category = data.get('category').strip()
    price_eur = data.get('price_eur')
    price_tl = data.get('price_tl')
    
    # Fiyat kontrolü - en az bir fiyat girilmeli
    if not price_eur and not price_tl:
        return jsonify({"error": "En az bir fiyat (Euro veya TL) girilmelidir"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Parça kodunun benzersiz olduğunu kontrol et
        cursor.execute('SELECT COUNT(*) FROM parts WHERE part_code = ?', (part_code,))
        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({"error": "Bu parça kodu zaten mevcut"}), 400
        
        # Yeni parçayı ekle
        cursor.execute('''
            INSERT INTO parts (part_code, part_name, category, price_eur, price_tl)
            VALUES (?, ?, ?, ?, ?)
        ''', (part_code, part_name, category, price_eur, price_tl))
        
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Parça başarıyla eklendi", "part_code": part_code}), 201
        
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# Parça güncelleme endpoint'i
@app.route('/api/update_part', methods=['PUT'])
def update_part():
    data = request.json
    
    # Gerekli alanları kontrol et
    if not data.get('part_code'):
        return jsonify({"error": "part_code alanı gereklidir"}), 400
    
    part_code = data.get('part_code').strip()
    updates = {}
    
    # Güncellenecek alanları belirle
    if 'part_name' in data and data['part_name']:
        updates['part_name'] = data['part_name'].strip()
    if 'category' in data and data['category']:
        updates['category'] = data['category'].strip()
    if 'price_eur' in data:
        updates['price_eur'] = data['price_eur']
    if 'price_tl' in data:
        updates['price_tl'] = data['price_tl']
    
    if not updates:
        return jsonify({"error": "Güncellenecek alan bulunamadı"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Parçanın var olduğunu kontrol et
        cursor.execute('SELECT COUNT(*) FROM parts WHERE part_code = ?', (part_code,))
        if cursor.fetchone()[0] == 0:
            conn.close()
            return jsonify({"error": "Parça bulunamadı"}), 404
        
        # Güncelleme sorgusunu oluştur
        set_clause = ', '.join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [part_code]
        
        cursor.execute(f'''
            UPDATE parts SET {set_clause} WHERE part_code = ?
        ''', values)
        
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Parça başarıyla güncellendi"}), 200
        
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# Parça detayları getirme endpoint'i
@app.route('/api/get_part/<part_code>', methods=['GET'])
def get_part_details(part_code):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT part_code, part_name, category, price_eur, price_tl 
            FROM parts WHERE part_code = ?
        ''', (part_code,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            part = dict(result)
            return jsonify(part), 200
        else:
            return jsonify({"error": "Parça bulunamadı"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# Parça silme endpoint'i
@app.route('/api/delete_part/<part_code>', methods=['DELETE'])
def delete_part(part_code):
    if not part_code:
        return jsonify({"error": "Parça kodu gereklidir"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Önce parçanın var olduğunu kontrol et
        cursor.execute('SELECT part_name FROM parts WHERE part_code = ?', (part_code,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return jsonify({"error": "Parça bulunamadı"}), 404
        
        part_name = result[0]
        
        # Parçayı sil
        cursor.execute('DELETE FROM parts WHERE part_code = ?', (part_code,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"error": "Parça silinemedi"}), 500
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "message": f"Parça başarıyla silindi: {part_code} - {part_name}",
            "deleted_part_code": part_code,
            "deleted_part_name": part_name
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# Test endpoint'i - Tüm parçaları listele (geliştirme amaçlı)
@app.route('/api/list_all_parts', methods=['GET'])
def list_all_parts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Sayfa parametresi (opsiyonel)
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        offset = (page - 1) * limit
        
        # Toplam parça sayısını al
        cursor.execute('SELECT COUNT(*) FROM parts')
        total_count = cursor.fetchone()[0]
        
        # Parçaları al (sayfalama ile)
        cursor.execute('''
            SELECT part_code, part_name, category, price_eur, price_tl, id 
            FROM parts 
            ORDER BY part_code 
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        results = cursor.fetchall()
        conn.close()
        
        parts = []
        for row in results:
            part = dict(row)
            parts.append(part)
        
        return jsonify({
            'parts': parts,
            'total_count': total_count,
            'page': page,
            'limit': limit,
            'total_pages': (total_count + limit - 1) // limit
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# Son eklenen parçaları göster endpoint'i
@app.route('/api/recent_parts', methods=['GET'])
def recent_parts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Son 10 parçayı ID'ye göre al (son eklenenler)
        cursor.execute('''
            SELECT part_code, part_name, category, price_eur, price_tl, id 
            FROM parts 
            ORDER BY id DESC 
            LIMIT 10
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        parts = []
        for row in results:
            part = dict(row)
            parts.append(part)
        
        return jsonify(parts), 200
        
    except Exception as e:
        return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500

# PDF oluşturma endpoint'i
@app.route('/api/create_work_order', methods=['POST'])
def create_work_order():
    data = request.json
    customer_info = data.get('customer_info', {})
    car_info = data.get('car_info', {})
    cart = data.get('cart', [])
    vat_rate = data.get('vat_rate', 20)
    discount_rate = data.get('discount_rate', 0)

    # Tarih formatını düzenleme (PDF için)
    def format_date(date_str):
        if date_str:
            try:
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                return date_obj.strftime('%d/%m/%Y')
            except ValueError:
                return date_str
        return ''

    customer_info['order_date'] = format_date(customer_info.get('order_date', ''))
    car_info['first_license_date'] = format_date(car_info.get('first_license_date', ''))
    car_info['vehicle_entry_date'] = format_date(car_info.get('vehicle_entry_date', ''))
    car_info['vehicle_delivery_date'] = format_date(car_info.get('vehicle_delivery_date', ''))
    
    # Fiyatları hesapla
    subtotal = sum(item['price_tl'] * item['quantity'] for item in cart)
    discount_amount = subtotal * (discount_rate / 100)
    subtotal_after_discount = subtotal - discount_amount
    vat_amount = subtotal_after_discount * (vat_rate / 100)
    total = subtotal_after_discount + vat_amount

    # Hesaplanan fiyatları bir sözlükte topla
    total_info = {
        'subtotal': subtotal,
        'discount_amount': discount_amount,
        'subtotal_after_discount': subtotal_after_discount,
        'vat_amount': vat_amount,
        'total': total
    }

    try:
        # CSS ve logo dosyasının mutlak yollarını al
        current_dir = os.path.dirname(os.path.abspath(__file__))
        pdf_style_path = os.path.join(current_dir, 'static', 'style_pdf.css')
        logo_path = os.path.join(current_dir, 'static', 'bosch-service-logo_image_1280w_960h.png')

        # PDF için HTML şablonunu render et ve statik dosya yollarını düzelt
        template_data = {
            'musteri_adi': customer_info.get('name', ''),
            'adres': customer_info.get('address', ''),
            'telefon': customer_info.get('phone', ''),
            'siparis_tarihi': customer_info.get('order_date', ''),
            'musteri_no': customer_info.get('customer_no', ''),
            'teklif_kisi_no': customer_info.get('offer_person_no', ''),
            'arac_giris_tarihi': car_info.get('vehicle_entry_date', ''),
            'arac_teslim_tarihi': car_info.get('vehicle_delivery_date', ''),
            'kdv_kayit_no': customer_info.get('tax_number', ''),
            'onay': customer_info.get('approval', ''),
            'harici_belge_no': customer_info.get('external_doc_no', ''),
            'car_info': car_info,
            'servis_personeli': car_info.get('service_staff', ''),
            'cart': cart,
            'vat_rate': vat_rate,
            'discount_rate': discount_rate,
            'total_info': total_info,
            'logo_path': f'file:///{logo_path.replace(os.sep, "/")}'
        }
        
        rendered_html = render_template(
            'index_pdf.html',
            **template_data
        )

        # pdfkit için seçenekleri tanımla
        options = {
            'enable-local-file-access': True,
            'encoding': 'UTF-8',
            'margin-top': '10mm',
            'margin-right': '10mm',
            'margin-bottom': '10mm',
            'margin-left': '10mm',
            'page-size': 'A4',
            'disable-smart-shrinking': True,
            'dpi': 300,
            'zoom': 1.0
        }

        # HTML'i PDF'e dönüştür ve CSS'i ekle
        pdf = pdfkit.from_string(
            rendered_html, 
            False, 
            options=options, 
            configuration=config,
            css=[pdf_style_path]
        )
        
        # Dinamik PDF dosya adı oluştur
        def create_filename(customer_info, car_info, cart):
            """Plaka - İşçilik1 + İşçilik2 + İşçilik3 - GG/AA/YYYY formatında dosya adı oluşturur"""
            import re
            
            # Plaka bilgisi
            plate = car_info.get('plate', '').strip()
            clean_plate = re.sub(r'[^a-zA-Z0-9]', '', plate) if plate else ''
            
            # Tarih bilgisi (bugünün tarihi)
            from datetime import datetime
            current_date = datetime.now().strftime('%d.%m.%Y')  # GG.AA.YYYY formatında
            
            # İşçilik bilgisi (sepetteki tüm işçilikler)
            labor_descriptions = []
            for item in cart:
                if item.get('type') == 'labor':
                    labor_description = item.get('description', '').strip()
                    if labor_description:
                        labor_descriptions.append(labor_description)
            
            # İşçilik açıklamalarını temizle
            def clean_labor_text(text):
                if not text:
                    return ''
                # Türkçe karakterleri değiştir
                replacements = {
                    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
                    'Ç': 'C', 'Ğ': 'G', 'I': 'I', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
                }
                for tr, en in replacements.items():
                    text = text.replace(tr, en)
                
                # Sadece harf, rakam ve boşluk bırak
                text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
                # Birden fazla boşluğu tek boşluk ile değiştir
                text = re.sub(r'\s+', ' ', text)
                # Başındaki ve sonundaki boşlukları kaldır
                text = text.strip()
                return text
            
            # Tüm işçilikleri temizle ve birleştir
            clean_labors = []
            for labor in labor_descriptions:
                clean_labor = clean_labor_text(labor)
                if clean_labor:
                    clean_labors.append(clean_labor)
            
            # İşçilikleri + işareti ile birleştir
            combined_labors = ' + '.join(clean_labors) if clean_labors else ''
            
            # Dosya adını oluştur: Plaka - İşçilik1 + İşçilik2 + İşçilik3 - GG.AA.YYYY
            filename_parts = []
            if clean_plate:
                filename_parts.append(clean_plate)
            if combined_labors:
                filename_parts.append(combined_labors)
            if current_date:
                filename_parts.append(current_date)
            
            # Eğer hiç bilgi yoksa varsayılan ad kullan
            if not filename_parts:
                return 'is_emri'
            
            # Maksimum uzunluk kontrolü (Windows dosya adı sınırı: 255 karakter)
            filename = '-'.join(filename_parts)
            if len(filename) > 200:  # .pdf uzantısı için yer bırak
                filename = filename[:200]
            
            return filename
        
        # Dosya adını oluştur
        filename = create_filename(customer_info, car_info, cart)
        
        # PDF'i bir yanıt olarak gönder
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}.pdf'
        return response

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"PDF oluşturma hatası: {e}")
        print(f"Hata detayları:\n{error_details}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/save_work_order', methods=['POST'])
def save_work_order():
    try:
        data = request.json
        customer_info = data.get('customer_info', {})
        car_info = data.get('car_info', {})
        cart = data.get('cart', [])
        vat_rate = data.get('vat_rate', 20)
        discount_rate = data.get('discount_rate', 0)
        target_folder = data.get('target_folder', '')

        # Tarih formatını düzenleme (PDF için)
        def format_date(date_str):
            if date_str:
                try:
                    date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                    return date_obj.strftime('%d/%m/%Y')
                except ValueError:
                    return date_str
            return ''

        customer_info['order_date'] = format_date(customer_info.get('order_date', ''))
        car_info['first_license_date'] = format_date(car_info.get('first_license_date', ''))
        car_info['vehicle_entry_date'] = format_date(car_info.get('vehicle_entry_date', ''))
        car_info['vehicle_delivery_date'] = format_date(car_info.get('vehicle_delivery_date', ''))
        
        # Fiyatları hesapla
        subtotal = sum(item['price_tl'] * item['quantity'] for item in cart)
        discount_amount = subtotal * (discount_rate / 100)
        subtotal_after_discount = subtotal - discount_amount
        vat_amount = subtotal_after_discount * (vat_rate / 100)
        total = subtotal_after_discount + vat_amount

        # Hesaplanan fiyatları bir sözlükte topla
        total_info = {
            'subtotal': subtotal,
            'discount_amount': discount_amount,
            'subtotal_after_discount': subtotal_after_discount,
            'vat_amount': vat_amount,
            'total': total
        }

        try:
            # CSS ve logo dosyasının mutlak yollarını al
            current_dir = os.path.dirname(os.path.abspath(__file__))
            pdf_style_path = os.path.join(current_dir, 'static', 'style_pdf.css')
            logo_path = os.path.join(current_dir, 'static', 'bosch-service-logo_image_1280w_960h.png')

            # PDF için HTML şablonunu render et ve statik dosya yollarını düzelt
            template_data = {
                'musteri_adi': customer_info.get('name', ''),
                'adres': customer_info.get('address', ''),
                'telefon': customer_info.get('phone', ''),
                'siparis_tarihi': customer_info.get('order_date', ''),
                'musteri_no': customer_info.get('customer_no', ''),
                'teklif_kisi_no': customer_info.get('offer_person_no', ''),
                'arac_giris_tarihi': car_info.get('vehicle_entry_date', ''),
                'arac_teslim_tarihi': car_info.get('vehicle_delivery_date', ''),
                'kdv_kayit_no': customer_info.get('tax_number', ''),
                'onay': customer_info.get('approval', ''),
                'harici_belge_no': customer_info.get('external_doc_no', ''),
                'car_info': car_info,
                'servis_personeli': car_info.get('service_staff', ''),
                'cart': cart,
                'vat_rate': vat_rate,
                'discount_rate': discount_rate,
                'total_info': total_info,
                'logo_path': f'file:///{logo_path.replace(os.sep, "/")}'
            }
            
            rendered_html = render_template(
                'index_pdf.html',
                **template_data
            )

            # pdfkit için seçenekleri tanımla
            options = {
                'enable-local-file-access': True,
                'encoding': 'UTF-8',
                'margin-top': '10mm',
                'margin-right': '10mm',
                'margin-bottom': '10mm',
                'margin-left': '10mm',
                'page-size': 'A4',
                'disable-smart-shrinking': True,
                'dpi': 300,
                'zoom': 1.0
            }

            # HTML'i PDF'e dönüştür ve CSS'i ekle
            pdf = pdfkit.from_string(
                rendered_html, 
                False, 
                options=options, 
                configuration=config,
                css=[pdf_style_path]
            )
            
            # Dinamik PDF dosya adı oluştur
            def create_filename(customer_info, car_info, cart):
                """Plaka - İşçilik1 + İşçilik2 + İşçilik3 - GG/AA/YYYY formatında dosya adı oluşturur"""
                
                # Plaka bilgisi
                plate = car_info.get('plate', '').strip()
                clean_plate = re.sub(r'[^a-zA-Z0-9]', '', plate) if plate else ''
                
                # Tarih bilgisi (bugünün tarihi)
                from datetime import datetime
                current_date = datetime.now().strftime('%d.%m.%Y')  # GG.AA.YYYY formatında
                
                # İşçilik bilgisi (sepetteki tüm işçilikler)
                labor_descriptions = []
                for item in cart:
                    if item.get('type') == 'labor':
                        labor_description = item.get('description', '').strip()
                        if labor_description:
                            labor_descriptions.append(labor_description)
                
                # İşçilik açıklamalarını temizle
                def clean_labor_text(text):
                    if not text:
                        return ''
                    # Türkçe karakterleri değiştir
                    replacements = {
                        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
                        'Ç': 'C', 'Ğ': 'G', 'I': 'I', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
                    }
                    for tr, en in replacements.items():
                        text = text.replace(tr, en)
                    
                    # Sadece harf, rakam ve boşluk bırak
                    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
                    # Birden fazla boşluğu tek boşluk ile değiştir
                    text = re.sub(r'\s+', ' ', text)
                    # Başındaki ve sonundaki boşlukları kaldır
                    text = text.strip()
                    return text
                
                # Tüm işçilikleri temizle ve birleştir
                clean_labors = []
                for labor in labor_descriptions:
                    clean_labor = clean_labor_text(labor)
                    if clean_labor:
                        clean_labors.append(clean_labor)
                
                # İşçilikleri + işareti ile birleştir
                combined_labors = ' + '.join(clean_labors) if clean_labors else 'ISCIK_YOK'
                
                # Dosya adını oluştur: Plaka - İşçilik1 + İşçilik2 + İşçilik3 - GG.AA.YYYY
                filename_parts = []
                if clean_plate:
                    filename_parts.append(clean_plate)
                if combined_labors:
                    filename_parts.append(combined_labors)
                if current_date:
                    filename_parts.append(current_date)
                
                # Eğer hiç bilgi yoksa varsayılan ad kullan
                if not filename_parts:
                    return 'is_emri'
                
                # Maksimum uzunluk kontrolü (Windows dosya adı sınırı: 255 karakter)
                filename = '-'.join(filename_parts)
                if len(filename) > 200:  # .pdf uzantısı için yer bırak
                    filename = filename[:200]
                
                return filename
            
            # Dosya adını oluştur
            filename = create_filename(customer_info, car_info, cart)
            
            # Hedef klasörde plaka adında alt klasör oluştur
            if target_folder and os.path.exists(target_folder):
                plate = car_info.get('plate', '').strip()
                clean_plate = re.sub(r'[^a-zA-Z0-9]', '', plate) if plate else 'PLAKA_YOK'
                
                # Alt klasör yolu
                subfolder_path = os.path.join(target_folder, clean_plate)
                
                # Alt klasörü oluştur (yoksa)
                try:
                    os.makedirs(subfolder_path, exist_ok=True)
                    print(f"Alt klasör oluşturuldu: {subfolder_path}")
                except Exception as e:
                    print(f"Alt klasör oluşturma hatası: {e}")
                    return jsonify({"error": f"Alt klasör oluşturulamadı: {str(e)}"}), 500
                
                # PDF dosyasını alt klasöre kaydet
                pdf_file_path = os.path.join(subfolder_path, f"{filename}.pdf")
                try:
                    with open(pdf_file_path, 'wb') as pdf_file:
                        pdf_file.write(pdf)
                    print(f"PDF dosyası kaydedildi: {pdf_file_path}")
                except Exception as e:
                    print(f"PDF kaydetme hatası: {e}")
                    return jsonify({"error": f"PDF dosyası kaydedilemedi: {str(e)}"}), 500
                
                return jsonify({
                    "success": True,
                    "message": "PDF başarıyla oluşturuldu ve kaydedildi",
                    "file_path": pdf_file_path,
                    "filename": f"{filename}.pdf"
                })
            else:
                # Hedef klasör belirtilmemişse sadece PDF'i döndür
                response = make_response(pdf)
                response.headers['Content-Type'] = 'application/pdf'
                response.headers['Content-Disposition'] = f'attachment; filename={filename}.pdf'
                return response

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"PDF oluşturma hatası: {e}")
            print(f"Hata detayları:\n{error_details}")
            return jsonify({"error": str(e)}), 500

    except Exception as e:
        print(f"İş emri kaydetme hatası: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Çalışma dizinini uygulama klasörüne sabitle
    try:
        base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
        os.chdir(base_dir)
    except Exception:
        pass

    # Veritabanını hazırla
    ensure_database_ready()
    
    # Veritabanı yolu bilgisini göster
    print(f"Veritabanı konumu: {DB_NAME}")
    if hasattr(sys, '_MEIPASS'):
        print("PyInstaller exe modunda çalışıyor - veritabanı kalıcı konumda saklanacak")

    # Tarayıcıyı otomatik aç (reloader olmadığı için tek sefer)
    threading.Timer(1.0, lambda: webbrowser.open('http://127.0.0.1:5000')).start()

    app.run(host='127.0.0.1', port=5000, debug=False)