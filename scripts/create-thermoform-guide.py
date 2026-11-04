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
STYLE=ParagraphStyle('body',fontName='Guide',fontSize=10.5,leading=15,textColor=INK)
def text(x,y,s,w=500,size=10.5,bold=False):
 st=ParagraphStyle('x',parent=STYLE,fontName='GuideBold' if bold else 'Guide',fontSize=size,leading=size*1.42)
 p=Paragraph(s,st);_,h=p.wrap(w,800);p.drawOn(C,x,y-h);return y-h
def header(page,title,sub):
 C.setFillColor(white);C.rect(0,0,595,842,fill=1,stroke=0)
 C.drawImage(ImageReader(str(ROOT/'public/betta-design-lab-logo.png')),40,772,width=130,height=65,preserveAspectRatio=True,mask='auto')
 text(40,751,title,size=27,bold=True);text(40,706,sub,size=11)
 C.setStrokeColor(GRAY);C.line(40,50,555,50);text(40,38,'BETTA DESIGN LAB · Thermoform · 04.11.2026',size=8)
 text(515,38,f'{page} / 5',w=45,size=8)
def box(x,y,w,h):
 C.setFillColor(HexColor('#f5f6f6'));C.roundRect(x,y,w,h,12,fill=1,stroke=0)
def arrow(x,y1,y2):
 C.setStrokeColor(ORANGE);C.setLineWidth(3);C.line(x,y1,x,y2);head=8 if y2<y1 else -8;C.line(x,y2,x-5,y2+head);C.line(x,y2,x+5,y2+head)
def sheet(cx,cy,scale=1):
 C.saveState();C.translate(cx,cy);C.scale(scale,scale);C.setStrokeColor(ORANGE);C.setLineWidth(3)
 C.setFillColor(HexColor('#fff0e8'));C.roundRect(-37,-28,74,56,20,fill=1,stroke=1)
 C.rect(-6,28,12,13,fill=1,stroke=1)
 for v in range(-24,25,12):C.line(-28,v,28,v)
 for v in range(-24,25,12):C.line(v,-21,v,21)
 C.restoreState()
def concave(cx,cy):
 C.setFillColor(GRAY);C.setStrokeColor(INK);C.setLineWidth(2)
 p=C.beginPath();p.moveTo(cx-65,cy+25);p.lineTo(cx-45,cy+25);p.curveTo(cx-40,cy-15,cx+40,cy-15,cx+45,cy+25);p.lineTo(cx+65,cy+25);p.lineTo(cx+65,cy-25);p.lineTo(cx-65,cy-25);p.close();C.drawPath(p,fill=1,stroke=1)
def convex(cx,cy):
 C.setFillColor(GRAY);C.setStrokeColor(INK);C.setLineWidth(2)
 p=C.beginPath();p.moveTo(cx-65,cy+15);p.lineTo(cx+65,cy+15);p.lineTo(cx+65,cy);p.lineTo(cx+43,cy);p.curveTo(cx+35,cy-40,cx-35,cy-40,cx-43,cy);p.lineTo(cx-65,cy);p.close();C.drawPath(p,fill=1,stroke=1)
def connector(cx,cy):
 C.setFillColor(GRAY);C.setStrokeColor(INK);C.setLineWidth(2);C.roundRect(cx-22,cy-22,44,44,4,fill=1,stroke=1)
 for k in [-12,-4,4,12]:C.line(cx-24,cy+k,cx+24,cy+k+6)
 C.setFillColor(white);C.rect(cx-7,cy-22,14,28,fill=1,stroke=1)
def cap(cx,cy):
 C.setFillColor(GRAY);C.setStrokeColor(INK);C.setLineWidth(2);C.roundRect(cx-27,cy-19,54,38,8,fill=1,stroke=1);C.circle(cx,cy+31,13,fill=1,stroke=1);C.setFillColor(white);C.circle(cx,cy+31,6,fill=1,stroke=1)

header(1,'Il tuo kit, pezzo per pezzo','Due sagome piatte, due stampi e tre componenti per la chiusura.')
for i,(n,title,desc) in enumerate(DATA['parts'][:6]):
 x=40+(i%2)*263;y=474-(i//2)*184;box(x,y,250,174)
 text(x+14,y+161,f'{n} · {title}',w=222,size=12,bold=True)
 if i<2:sheet(x+125,y+90,.85)
 elif i==2:concave(x+125,y+90)
 elif i==3:convex(x+125,y+100)
 elif i==4:connector(x+125,y+90)
 else:cap(x+125,y+80)
 text(x+14,y+48,desc,w=222,size=9)
text(40,80,'07 · Perno di blocco: illustrato nel montaggio a pagina 4. Schemi non in scala.',size=9)
C.showPage()

header(2,'Dalla rete alla bombatura','Lavora su una metà alla volta. Gli stampi servono come coppia, non si uniscono al contenitore.')
box(40,386,515,265)
convex(170,589);text(280,606,'04 · Convesso capovolto',w=250,size=12,bold=True)
text(280,583,'La bombatura guarda verso il concavo.',w=242,size=10)
arrow(170,544,521)
C.setStrokeColor(ORANGE);C.setLineWidth(4);C.line(108,504,232,504)
text(280,518,'01 o 02 · Sagoma scaldata',w=245,size=12,bold=True)
text(280,495,'Bordo allineato; linguetta nel canale.',w=242,size=10)
arrow(170,484,462);concave(170,424)
text(280,445,'03 · Matrice concava',w=245,size=12,bold=True)
text(280,422,'Premi senza forzare e lascia raffreddare.',w=242,size=10)
y=368
for i,(title,desc) in enumerate(DATA['steps'][:3]):
 y=text(40,y,f'{i+1}. {title}',size=12,bold=True)-5
 y=text(40,y,desc,size=9.7)-12
C.showPage()

header(3,'Premi, raffredda, ripeti','La forma si stabilizza negli stampi. Estrai la metà soltanto dopo il raffreddamento.')
box(40,436,515,215)
convex(165,602);arrow(165,559,542);concave(165,496)
text(280,602,'Tieni allineati gli stampi',w=235,size=12,bold=True)
text(280,574,'Premi gradualmente. Non forzare se il bordo o la linguetta si piegano.',w=235,size=11)
text(280,520,'Aspetta il raffreddamento',w=235,size=12,bold=True)
text(280,492,'Apri gli stampi, estrai e controlla bordo, rete e linguetta.',w=235,size=11)
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
cap(164,578);arrow(164,545,527);connector(164,496)
C.setFillColor(ORANGE);C.rect(128,492,72,7,fill=1,stroke=0);text(70,512,'07',w=40,size=12,bold=True)
C.setFillColor(ORANGE);C.setStrokeColor(ORANGE);C.rect(151,435,9,35,fill=1,stroke=0);C.rect(168,435,9,35,fill=1,stroke=0)
arrow(164,418,433)
text(280,612,'06 · Tappo con occhiello',w=245,size=12,bold=True)
text(280,588,'Si avvita sul raccordo, non direttamente sulle sagome.',w=230,size=10)
text(280,528,'05 + 07 · Raccordo e perno',w=245,size=12,bold=True)
text(280,503,'Il perno attraversa i fori delle due linguette. Il tappo ne impedisce l’uscita laterale.',w=230,size=10)
text(280,454,'01 + 02 · Le due metà',w=245,size=12,bold=True)
text(280,430,'Accosta i bordi; bombature verso l’esterno.',w=230,size=10)
y=text(40,394,'6. '+DATA['steps'][5][0],size=13,bold=True)-6
y=text(40,y,DATA['steps'][5][1],size=10.5)-15
y=text(40,y,'Per recuperare il kit già stampato',size=13,bold=True)-6
y=text(40,y,'A parità di configurazione, sagome 01 e 02, convesso 04 e tappo 06 sono invariati. Ristampa il concavo 03, il raccordo 05 e il perno 07. Il vecchio raccordo non ha il passaggio per il perno: va sostituito. Verifica comunque che i fori nelle linguette non siano stati deformati dal calore.',size=10.5)
C.showPage()
header(5,'Prima di usare il kit','Revisione dopo la prima prova: verifica rilascio e chiusura con un campione piccolo.')
y=text(40,651,'Controlli prima della formatura',size=15,bold=True)-12
for note in DATA['notes']:
 y=text(40,y,'• '+note,size=11)-16
y=text(40,y-1,'Fonti del procedimento · consultate il 3 novembre 2026 · revisione 4 novembre',size=9,bold=True)-4
for name,url in DATA['sources']:
 y=text(40,y,f'<link href="{url}" color="#b43310">{name}</link>',size=8.5)-3

C.save()
print(OUT)
