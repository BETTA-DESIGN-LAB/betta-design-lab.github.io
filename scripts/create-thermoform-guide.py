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
 text(515,38,f'{page} / 6',w=45,size=8)
def box(x,y,w,h):
 C.setFillColor(HexColor('#f5f6f6'));C.roundRect(x,y,w,h,12,fill=1,stroke=0)
def arrow(x,y1,y2):
 C.setStrokeColor(ORANGE);C.setLineWidth(3);C.line(x,y1,x,y2);head=8 if y2<y1 else -8;C.line(x,y2,x-5,y2+head);C.line(x,y2,x+5,y2+head)
IMAGES=ROOT/'tmp/pdfs/thermoform-images'
def img(name,x,y,w,h):
 path=IMAGES/(name+'.png')
 if not path.exists():raise FileNotFoundError('Esegui prima export-thermoform-guide.ts e render-thermoform-guide.py')
 C.drawImage(str(path),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c',mask='auto')

header(1,'Il kit con filetto integrato','Sei pezzi: due reti con mezzo collo, due stampi, tappo e piccola clip.')
for i,(n,title,desc) in enumerate(DATA['parts']):
 x=40+(i%2)*263;y=474-(i//2)*184;box(x,y,250,174)
 text(x+14,y+161,f'{n} · {title}',w=222,size=12,bold=True)
 names=['part-front','part-back','part-female','part-male','cap-under','part-bottom-clip']
 img(names[i],x+35,y+48,180,85)
 text(x+14,y+38,desc,w=222,size=9)
text(40,80,'Render dei pezzi reali, non in scala. Nessun raccordo o perno separato.',size=9)
C.showPage()

header(2,'Prepara e scalda la rete','Forma una metà alla volta. Il collo filettato deve rimanere freddo.')
box(40,386,515,265);img('exploded',45,391,270,255)
text(328,621,'04 · Convesso capovolto',w=215,size=12,bold=True)
text(328,595,'La bombatura guarda verso il basso.',w=210,size=10.5)
text(328,535,'01 o 02 · Rete capovolta',w=215,size=12,bold=True)
text(328,510,'Lato liscio in alto, mezzo collo rivolto in basso nel suo invito.',w=210,size=10.5)
text(328,449,'03 · Stampo concavo',w=215,size=12,bold=True)
text(328,424,'Controlla che il profilo coincida prima di scaldare.',w=210,size=10.5)
y=369
for i,(title,desc) in enumerate(DATA['steps'][:3]):
 y=text(40,y,f'{i+1}. {title}',size=12,bold=True)-5
 y=text(40,y,desc,size=10)-12
C.showPage()

header(3,'Forma e lascia raffreddare','Il convesso preme sulla rete; l’invito aperto protegge il mezzo collo.')
box(40,436,515,215);img('pressed',45,449,280,181)
text(337,624,'Vista in sezione',w=205,size=12,bold=True)
text(337,593,'La rete arancione segue la bombatura fra i due stampi blu.',w=200,size=11)
text(337,523,'Il collo non deve essere schiacciato o scaldato.',w=200,size=11,bold=True)
text(337,470,'Sezione illustrativa: gli stampi reali sono interi.',w=200,size=9)
y=412
for i,(title,desc) in enumerate(DATA['steps'][3:5],start=4):
 y=text(40,y,f'{i}. {title}',size=13,bold=True)-7
 y=text(40,y,desc,size=11)-20
y=text(40,y,'Impronte speculari',size=13,bold=True)-7
y=text(40,y,DATA['notes'][2],size=11)-18
y=text(40,y,'Rete o superficie piena?',size=13,bold=True)-7
text(40,y,DATA['notes'][1],size=11)
C.showPage()

header(4,'Due metà, un solo filetto','Accosta i lati piatti: i giri del filetto devono proseguire da una metà all’altra.')
box(40,416,515,235)
text(53,638,'1 · Mezzi colli separati',w=230,size=12,bold=True)
text(315,638,'2 · Collo completo',w=230,size=12,bold=True)
img('neck-separated',45,442,248,178);img('neck-joined',302,442,248,178)
text(50,432,'Arancione = fronte · giallo = retro. Sono parti delle reti, non raccordi separati.',size=8.5)
y=text(40,398,'6. '+DATA['steps'][5][0],size=13,bold=True)-6
text(40,y,DATA['steps'][5][1],size=10.5)
box(40,72,252,192);box(303,72,252,192)
text(53,252,'3 · Appoggia il tappo',w=220,size=12,bold=True)
text(316,252,'4 · Avvita a mano',w=220,size=12,bold=True)
img('cap-down',48,82,236,147);img('closed',311,82,236,147)
C.showPage()

header(5,'Piccolo fermo sul fondo','La clip 06 a U trattiene le due sedi nel bordo inferiore.')
box(40,412,515,239)
text(53,638,'1 · Fai scorrere la clip',w=230,size=12,bold=True)
text(315,638,'2 · Controlla lo scatto',w=230,size=12,bold=True)
img('bottom-open',45,441,248,179);img('bottom-closed',302,441,248,179)
text(50,432,'Sedi piatte: arancione = fronte · giallo = retro · verde = clip.',size=9)
y=text(40,395,'7. '+DATA['steps'][6][0],size=13,bold=True)-7
text(40,y,DATA['steps'][6][1],size=10.5)
box(40,73,515,205);img('whole',48,83,250,185)
text(315,260,'Prima di ristampare tutto',w=220,size=13,bold=True)
text(315,226,'Prova il campione a freddo: due mezzi colli con tappo, poi due sedi con clip.',w=220,size=10.5)
text(315,151,'Per aprire: sfila la clip e svita il tappo. Non serve colla.',w=220,size=10.5)
C.showPage()

header(6,'Prima di usare il nuovo kit','La revisione con mezzi filetti richiede nuove sagome, nuovi stampi e nuovo tappo.')
y=text(40,651,'Compatibilità con le stampe precedenti',size=14,bold=True)-8
y=text(40,y,'Questa chiusura sostituisce il raccordo separato e il suo perno: non si monta sulle vecchie sagome. Usa tutti i sei pezzi della stessa configurazione. Non mescolare tappo, stampi o clip delle revisioni precedenti.',size=11)-22
for note in DATA['notes']:
 y=text(40,y,'• '+note,size=10.5)-14
y=text(40,y,'Riferimenti del procedimento · geometrie Betta Design Lab originali',size=9,bold=True)-6
for name,url in DATA['sources']:
 y=text(40,y,f'<link href="{url}" color="#b43310">{name}</link>',size=8.5)-4
C.save()
print(OUT)
