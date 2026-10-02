"""Generate small test STEP files for the parser service."""
import cadquery as cq, os
here = os.path.dirname(os.path.abspath(__file__))

# Turned lid: Ø55 x 12 with Ø30 bore 8 deep, 4 axial Ø4.2 holes, chamfer on OD.
lid = (cq.Workplane("XY").circle(27.5).extrude(12)
       .faces(">Z").workplane().hole(30, 8)
       .faces(">Z").workplane().polarArray(21, 0, 360, 4).hole(4.2)
       .faces("<Z").edges().chamfer(0.8))
cq.exporters.export(lid, os.path.join(here, "turned_lid.step"))

# Milled block: 80x50x20 with a 40x20x8 pocket (R3 corners), slot and 2 holes.
block = (cq.Workplane("XY").box(80, 50, 20)
         .faces(">Z").workplane().rect(40, 20).cutBlind(-8)
         .faces(">Z").workplane().pushPoints([(-30, 15), (30, 15)]).hole(6))
cq.exporters.export(block, os.path.join(here, "milled_block.step"))
print("ok")

# Same lid with every closed cylinder/cone split in two, the way SolidWorks
# and similar CAD tools export them. Used as a regression check that the
# service fix leaves results for this style of STEP unchanged.
from OCP.ShapeUpgrade import ShapeUpgrade_ShapeDivideClosed
div = ShapeUpgrade_ShapeDivideClosed(lid.val().wrapped)
div.SetNbSplitPoints(1)
div.Perform()
cq.exporters.export(cq.Shape.cast(div.Result()), os.path.join(here, "turned_lid_split.step"))
print("split ok")
