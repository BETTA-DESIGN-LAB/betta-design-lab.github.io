"""Rigenera la guida illustrata usando gli stessi contenuti del generatore."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import reportlab
from PIL import Image
FONTS=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont("Guide", str(FONTS/'Vera.ttf')))
pdfmetrics.registerFont(TTFont("GuideBold", str(FONTS/'VeraBd.ttf')))

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'apps/thermoform/src/guide-content.json').read_text())
OUT=ROOT/'apps/thermoform/guida-thermoform.pdf'
C=canvas.Canvas(str(OUT),pagesize=(595,842))
C.setTitle('Thermoform - guida alla formatura e al montaggio | Betta Design Lab')
C.setAuthor('Betta Design Lab')
ORANGE=HexColor('#ff4b16'); INK=HexColor('#202326'); GRAY=HexColor('#dbe1e5')
LOGO_SOURCE=Image.open(ROOT/'public/betta-design-lab-logo.png').convert('RGBA')
LOGO_WHITE=Image.new('RGB',LOGO_SOURCE.size,'white');LOGO_WHITE.paste(LOGO_SOURCE,mask=LOGO_SOURCE.getchannel('A'))
LOGO=ImageReader(LOGO_WHITE)
STYLE=ParagraphStyle('body',fontName='Guide',fontSize=10.5,leading=15,textColor=INK)
def text(x,y,s,w=500,size=10.5,bold=False):
 st=ParagraphStyle('x',parent=STYLE,fontName='GuideBold' if bold else 'Guide',fontSize=size,leading=size*1.42)
 p=Paragraph(s,st);_,h=p.wrap(w,800);p.drawOn(C,x,y-h);return y-h
def header(page,title,sub):
 C.setFillColor(white);C.rect(0,0,595,842,fill=1,stroke=0)
 C.drawImage(LOGO,40,772,width=130,height=65,preserveAspectRatio=True)
 text(40,751,title,size=27,bold=True);text(40,706,sub,size=11)
 C.setStrokeColor(GRAY);C.line(40,50,555,50);text(40,38,'BETTA DESIGN LAB · Thermoform · 04.11.2026',size=8)
 text(515,38,f'{page} / 7',w=45,size=8)
def box(x,y,w,h):
 C.setFillColor(HexColor('#f5f6f6'));C.roundRect(x,y,w,h,12,fill=1,stroke=0)
def arrow(x,y1,y2):
 C.setStrokeColor(ORANGE);C.setLineWidth(3);C.line(x,y1,x,y2);head=8 if y2<y1 else -8;C.line(x,y2,x-5,y2+head);C.line(x,y2,x+5,y2+head)
IMAGES=ROOT/'tmp/pdfs/thermoform-images'
def img(name,x,y,w,h):
 path=IMAGES/(name+'.png')
 if not path.exists():raise FileNotFoundError('Esegui prima export-thermoform-guide.ts e render-thermoform-guide.py')
 C.drawImage(str(path),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c',mask='auto')
def sheet(cx,cy,scale=1,index=0):
 img('part-front' if index==0 else 'part-back',cx-75,cy-48,150,80)
def concave(cx,cy):img('part-female',cx-85,cy-50,170,80)
def convex(cx,cy):img('part-male',cx-85,cy-50,170,80)
def connector(cx,cy):img('part-connector',cx-70,cy-52,140,80)
def cap(cx,cy):img('cap-under',cx-70,cy-50,140,80)

header(1,'Il tuo kit, pezzo per pezzo','Due sagome piatte, due stampi e quattro componenti per la chiusura.')
for i,(n,title,desc) in enumerate(DATA['parts'][:6]):
 x=40+(i%2)*263;y=474-(i//2)*184;box(x,y,250,174)
 text(x+14,y+161,f'{n} · {title}',w=222,size=12,bold=True)
 if i<2:sheet(x+125,y+90,.85,i)
 elif i==2:concave(x+125,y+90)
 elif i==3:convex(x+125,y+90)
 elif i==4:connector(x+125,y+90)
 else:cap(x+125,y+90)
 text(x+14,y+38,desc,w=222,size=9)
text(40,80,'07 · Perno: pagina 4. 08 · Clip inferiore: pagina 6. Render dei pezzi reali; non in scala.',size=9)
C.showPage()

header(2,'Dalla rete alla bombatura','Lavora su una metà alla volta. Gli stampi servono come coppia, non si uniscono al contenitore.')
box(40,386,515,265)
img('exploded',45,391,270,255)
text(328,621,'04 · Convesso capovolto',w=215,size=12,bold=True)
text(328,596,'La bombatura guarda in basso, verso il concavo.',w=210,size=10.5)
text(328,535,'01 o 02 · Sagoma',w=215,size=12,bold=True)
text(328,510,'Bordo allineato. La linguetta resta nel canale.',w=210,size=10.5)
text(328,449,'03 · Stampo concavo',w=215,size=12,bold=True)
text(328,424,'Qui appoggi la sagoma piatta prima di scaldarla.',w=210,size=10.5)
y=368
for i,(title,desc) in enumerate(DATA['steps'][:3]):
 y=text(40,y,f'{i+1}. {title}',size=12,bold=True)-5
 y=text(40,y,desc,size=9.7)-12
C.showPage()

header(3,'Premi, raffredda, ripeti','La forma si stabilizza negli stampi. Estrai la metà soltanto dopo il raffreddamento.')
box(40,436,515,215)
img('pressed',45,449,280,181)
text(337,624,'Vista in sezione',w=205,size=12,bold=True)
text(337,592,'La rete arancione si trova fra concavo e convesso blu.',w=200,size=11)
text(337,526,'Premi e lascia raffreddare prima di estrarre.',w=200,size=11,bold=True)
text(337,474,'Gli stampi reali sono interi: qui sono tagliati solo per vedere dentro.',w=200,size=9)
y=412
for i,(title,desc) in enumerate(DATA['steps'][3:5],start=4):
 y=text(40,y,f'{i}. {title}',size=13,bold=True)-7
 y=text(40,y,desc,size=11)-20
y=text(40,y,'Le impronte speculari',size=13,bold=True)-7
y=text(40,y,DATA['notes'][2],size=11)-18
y=text(40,y,'Rete o superficie piena?',size=13,bold=True)-7
y=text(40,y,DATA['notes'][1],size=11)
C.showPage()

header(4,'La chiusura, senza colla','Prima prova a freddo; avvita a mano e verifica che entrambe le linguette siano trattenute.')
box(40,413,515,238)
text(53,639,'1 · Allinea e inserisci',w=236,size=12,bold=True)
text(315,639,'2 · Centra il perno',w=226,size=12,bold=True)
img('pin-out',45,432,248,185)
img('pin-in',302,432,248,185)
text(45,425,'Raccordo in sezione: arancione = fronte, giallo = retro, verde = perno.',w=505,size=8.5)
y=text(40,394,'6. '+DATA['steps'][5][0],size=13,bold=True)-6
y=text(40,y,DATA['steps'][5][1],size=10.5)-15
y=text(40,y,'Per recuperare il kit già stampato',size=13,bold=True)-6
y=text(40,y,'Per avere il blocco inferiore servono le nuove sagome 01 e 02, i nuovi stampi 03 e 04 e la clip 08. Le vecchie sagome non hanno le linguette inferiori. A parità di impostazioni, raccordo 05, tappo 06 e perno 07 della revisione precedente restano compatibili.',size=10.5)
C.showPage()
header(5,'Avvita solo dopo il perno','Il tappo impedisce al perno di uscire lateralmente. Non serve colla.')
box(40,368,252,283);box(303,368,252,283)
text(53,638,'3 · Fai scendere il tappo',w=226,size=12,bold=True)
text(316,638,'4 · Chiudi a mano',w=226,size=12,bold=True)
img('cap-down',48,401,236,218);img('closed',311,401,236,218)
text(53,393,'Il perno è già inserito e centrato.',w=225,size=10)
text(316,393,'Non forzare la filettatura.',w=225,size=10)
box(40,88,515,258)
img('whole',48,99,245,237)
text(315,326,'Controllo finale',w=226,size=14,bold=True)
text(315,289,'Tira delicatamente le due metà: devono restare unite. Se una si sfila, controlla che il perno attraversi entrambi i fori.',w=222,size=11)
text(315,207,'Per aprire: sfila prima la clip inferiore, poi svita il tappo e rimuovi il perno.',w=222,size=11)
text(315,126,'Prima conferma la tenuta con una prova fisica.',w=222,size=10,bold=True)
C.showPage()
header(6,'Blocca anche il fondo','La clip 08 tiene unite le linguette inferiori: non è il perno superiore.')
box(40,405,515,246)
text(53,638,'1 · Inserisci dal basso',w=230,size=12,bold=True)
text(315,638,'2 · Verifica lo scatto',w=230,size=12,bold=True)
img('bottom-open',45,433,248,180);img('bottom-closed',302,433,248,180)
text(50,424,'Arancione = fronte · giallo = retro · verde = clip inferiore',size=9)
y=text(40,384,'7. '+DATA['steps'][6][0],size=14,bold=True)-10
y=text(40,y,DATA['steps'][6][1],size=11)-24
y=text(40,y,'Prima prova a freddo',size=14,bold=True)-8
text(40,y,'Accosta le linguette ancora piatte e prova la clip prima di scaldare la rete. Se lo scatto è duro, non forzare: aumenta il gioco nel generatore e ristampa un campione. La clip resta separata durante la formatura.',size=11)
C.showPage()
header(7,'Prima di usare il kit','Revisione dopo la prima prova: verifica rilascio e chiusura con un campione piccolo.')
y=text(40,651,'Controlli prima della formatura',size=15,bold=True)-12
for note in DATA['notes']:
 y=text(40,y,'• '+note,size=11)-16
y=text(40,y-1,'Fonti del procedimento · consultate il 3 novembre 2026 · revisione 4 novembre',size=9,bold=True)-4
for name,url in DATA['sources']:
 y=text(40,y,f'<link href="{url}" color="#b43310">{name}</link>',size=8.5)-3

C.save()
print(OUT)
